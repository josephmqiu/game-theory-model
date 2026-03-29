import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import * as entityGraphService from "../entity-graph-service";
import {
  createThreadService,
  deriveThreadTitleFromMessage,
} from "../workspace/thread-service";
import { getProviderSessionBinding } from "../workspace/provider-session-binding-service";
import { createProcessRuntimeError } from "../../../shared/types/runtime-error";
import type {
  WorkspaceRuntimeChatEvent,
  WorkspaceRuntimeChatTurnStartRequestPayload,
} from "../../../shared/types/workspace-runtime";
import { getRuntimeAdapter } from "./adapter-contract";
import { resolvePromptTemplate } from "../prompt-pack-registry";
import {
  DEFAULT_ANALYSIS_TYPE,
  CHAT_PROMPT_PACK_MODE,
} from "../../../shared/types/prompt-pack";

import {
  isAllowedRuntimeProvider,
  type RuntimeProvider,
} from "../../../shared/types/analysis-runtime";

export const SENSITIVE_LOG_PATTERN =
  /ANTHROPIC_API_KEY=|Authorization:\s*Bearer|api[_-]?key\s*[:=]/i;

export const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface ChatAttachmentWire {
  name: string;
  mediaType: string;
  data: string;
}

const isAllowedProvider = isAllowedRuntimeProvider;

function buildServerChatSystemPrompt(): string {
  const analysis = entityGraphService.getAnalysis();
  const hasCanvasAnalysis =
    analysis.topic.trim().length > 0 || analysis.entities.length > 0;

  const templateId = hasCanvasAnalysis
    ? "system-with-analysis"
    : "system-empty-canvas";
  const resolved = resolvePromptTemplate({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: CHAT_PROMPT_PACK_MODE,
    templateId,
    variant: "initial",
  });
  const basePrompt = resolved.text;

  const phaseStatuses = analysis.phases
    .map((phaseStatus) => `${phaseStatus.phase}: ${phaseStatus.status}`)
    .join(", ");

  const context = [
    "ANALYSIS CONTEXT:",
    `Topic: ${analysis.topic || "(no topic)"}`,
    `Entities on canvas: ${analysis.entities.length}`,
    `Phases: ${phaseStatuses}`,
    analysis.centralThesis ? `Central Thesis: ${analysis.centralThesis}` : "",
    "",
    "Use query_entities, get_entity, and query_relationships tools to inspect entity details when needed.",
  ]
    .filter(Boolean)
    .join("\n");

  return `${basePrompt}\n\n${context}`;
}

export function resolveMediaExtension(mediaType: string): string {
  return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType.split("/")[1] : "png";
}

async function saveAttachmentsToTempFiles(
  attachments: ChatAttachmentWire[],
  insideProject = false,
): Promise<{ tempDir: string; files: string[] }> {
  let tempDir: string;
  if (insideProject) {
    const baseDir = join(process.cwd(), ".game-theory-analyzer-tmp");
    mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    chmodSync(baseDir, 0o700);
    tempDir = await mkdtemp(join(baseDir, "attach-"));
  } else {
    tempDir = await mkdtemp(join(tmpdir(), "game-theory-analyzer-attach-"));
  }

  const files: string[] = [];
  for (const attachment of attachments) {
    const extension = resolveMediaExtension(attachment.mediaType);
    const filePath = join(tempDir, `${files.length}.${extension}`);
    await writeFile(filePath, Buffer.from(attachment.data, "base64"));
    files.push(filePath);
  }

  return { tempDir, files };
}

function stripNoToolsRestriction(systemPrompt: string): string {
  return systemPrompt
    .replace(/^.*NEVER use tools.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeActivityKind(toolName: string, query?: string) {
  if (query || /web.?search/i.test(toolName)) {
    return "web-search" as const;
  }
  return "tool" as const;
}

function extractQueryFromToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as Record<string, unknown>;
  const raw =
    typeof candidate.query === "string"
      ? candidate.query
      : typeof candidate.search_query === "string"
        ? candidate.search_query
        : undefined;

  return raw?.trim() || undefined;
}

export interface StartChatTurnOptions {
  runId?: string;
  correlationId?: string;
  producer?: string;
  onEvent?: (
    event: WorkspaceRuntimeChatEvent,
    context: {
      workspaceId: string;
      threadId: string;
      correlationId: string;
    },
  ) => void;
}

export interface StartedChatTurn {
  workspaceId: string;
  threadId: string;
  correlationId: string;
  completion: Promise<void>;
}

function buildRuntimeChatError(
  message: string,
  provider: RuntimeProvider,
): ReturnType<typeof createProcessRuntimeError> {
  return createProcessRuntimeError(message, {
    provider,
    processState: "failed-to-start",
    retryable: false,
  });
}

async function executeChatTurn(
  request: WorkspaceRuntimeChatTurnStartRequestPayload,
  options: Required<Pick<StartChatTurnOptions, "correlationId" | "producer">> &
    Pick<StartChatTurnOptions, "runId" | "onEvent"> & {
      workspaceId: string;
      threadId: string;
      systemPrompt: string;
      history: Array<{ role: string; content: string }>;
    },
): Promise<void> {
  const threadService = createThreadService();
  const abortController = new AbortController();
  const pendingToolMetadata = new Map<string, Array<{ query?: string }>>();
  let accumulated = "";
  let attachmentTempDir: string | undefined;

  try {
    let prompt = request.message.content;
    if (
      request.provider === "claude" &&
      request.message.attachments &&
      request.message.attachments.length > 0
    ) {
      const saved = await saveAttachmentsToTempFiles(
        request.message.attachments,
        true,
      );
      attachmentTempDir = saved.tempDir;
      const imageRefs = saved.files
        .map((file) => {
          return `First, use the Read tool to read the image file at "${file}". Then analyze it and respond to the user.`;
        })
        .join("\n");
      prompt =
        imageRefs + "\n\n" + (prompt || "Describe what you see in the image.");
    }

    const adapter = await getRuntimeAdapter(request.provider);
    const session = adapter.createSession(
      {
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        ...(options.runId ? { runId: options.runId } : {}),
        purpose: "chat",
      },
      getProviderSessionBinding(options.threadId, "chat"),
    );

    const effectiveSystemPrompt =
      request.provider === "claude" &&
      request.message.attachments &&
      request.message.attachments.length > 0
        ? stripNoToolsRestriction(options.systemPrompt)
        : options.systemPrompt;

    try {
      for await (const eventChunk of session.streamChatTurn({
        prompt,
        systemPrompt: effectiveSystemPrompt,
        messages: options.history,
        model: request.model,
        runId: options.runId,
        signal: abortController.signal,
      })) {
        if (eventChunk.type === "text_delta") {
          // Only accumulate output text for persistence — reasoning is ephemeral
          if (eventChunk.content_kind !== "reasoning") {
            accumulated += eventChunk.content;
          }
          options.onEvent?.(
            {
              type: "chat.message.delta",
              correlationId: options.correlationId,
              content: eventChunk.content,
              ...(eventChunk.content_kind
                ? { content_kind: eventChunk.content_kind }
                : {}),
            },
            {
              workspaceId: options.workspaceId,
              threadId: options.threadId,
              correlationId: options.correlationId,
            },
          );
        }

        if (eventChunk.type === "tool_call_start") {
          const queue = pendingToolMetadata.get(eventChunk.toolName) ?? [];
          queue.push({
            query: extractQueryFromToolInput(eventChunk.input),
          });
          pendingToolMetadata.set(eventChunk.toolName, queue);
          options.onEvent?.(
            {
              type: "chat.tool.start",
              correlationId: options.correlationId,
              toolName: eventChunk.toolName,
            },
            {
              workspaceId: options.workspaceId,
              threadId: options.threadId,
              correlationId: options.correlationId,
            },
          );
        }

        if (
          eventChunk.type === "tool_call_result" ||
          eventChunk.type === "tool_call_error"
        ) {
          const queue = pendingToolMetadata.get(eventChunk.toolName) ?? [];
          const metadata = queue.shift();
          if (queue.length === 0) {
            pendingToolMetadata.delete(eventChunk.toolName);
          } else {
            pendingToolMetadata.set(eventChunk.toolName, queue);
          }

          const query = metadata?.query;
          const kind = normalizeActivityKind(eventChunk.toolName, query);
          threadService.recordActivity({
            workspaceId: options.workspaceId,
            threadId: options.threadId,
            scope: "chat-turn",
            kind,
            message:
              eventChunk.type === "tool_call_error"
                ? `Tool ${eventChunk.toolName} failed: ${eventChunk.error}`
                : `Used ${eventChunk.toolName}`,
            status:
              eventChunk.type === "tool_call_error" ? "failed" : "completed",
            toolName: eventChunk.toolName,
            query,
            producer: options.producer,
            occurredAt: Date.now(),
            correlationId: options.correlationId,
          });

          if (eventChunk.type === "tool_call_error") {
            options.onEvent?.(
              {
                type: "chat.tool.error",
                correlationId: options.correlationId,
                toolName: eventChunk.toolName,
                error: eventChunk.error,
              },
              {
                workspaceId: options.workspaceId,
                threadId: options.threadId,
                correlationId: options.correlationId,
              },
            );
          } else {
            options.onEvent?.(
              {
                type: "chat.tool.result",
                correlationId: options.correlationId,
                toolName: eventChunk.toolName,
                output: eventChunk.output,
              },
              {
                workspaceId: options.workspaceId,
                threadId: options.threadId,
                correlationId: options.correlationId,
              },
            );
          }
        }

        if (eventChunk.type === "error") {
          options.onEvent?.(
            {
              type: "chat.message.error",
              correlationId: options.correlationId,
              error: eventChunk.error,
            },
            {
              workspaceId: options.workspaceId,
              threadId: options.threadId,
              correlationId: options.correlationId,
            },
          );
        }
      }
    } finally {
      const diagnostics = session.getDiagnostics();
      const recovery = diagnostics.recovery;
      if (recovery) {
        threadService.recordActivity({
          workspaceId: options.workspaceId,
          threadId: options.threadId,
          scope: "chat-turn",
          kind: "note",
          message:
            recovery.disposition === "resumed"
              ? `${request.provider === "codex" ? "Codex app-server" : "Claude Code"} resumed persisted provider session`
              : (recovery.message ??
                `${request.provider === "codex" ? "Codex app-server" : "Claude Code"} started a fresh provider session`),
          status: recovery.disposition === "fallback" ? "failed" : "completed",
          producer: options.producer,
          occurredAt: recovery.timestamp,
          correlationId: options.correlationId,
        });
      }
      await session.dispose();
    }

    let assistantMessageId: string | undefined;
    let assistantMessageContent = accumulated;
    if (accumulated.trim().length > 0) {
      const assistantMessage = threadService.recordMessage({
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        role: "assistant",
        content: accumulated,
        messageId: `msg-${nanoid()}`,
        occurredAt: Date.now(),
        producer: options.producer,
        correlationId: options.correlationId,
      });
      assistantMessageId = assistantMessage.id;
      assistantMessageContent = assistantMessage.content;
    }

    options.onEvent?.(
      {
        type: "chat.message.complete",
        correlationId: options.correlationId,
        ...(assistantMessageId ? { messageId: assistantMessageId } : {}),
        content: assistantMessageContent,
      },
      {
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        correlationId: options.correlationId,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (accumulated.trim().length > 0) {
      threadService.recordMessage({
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        role: "assistant",
        content: accumulated,
        occurredAt: Date.now(),
        producer: options.producer,
        correlationId: options.correlationId,
      });
    }

    threadService.recordActivity({
      workspaceId: options.workspaceId,
      threadId: options.threadId,
      scope: "chat-turn",
      kind: "note",
      message,
      status: "failed",
      producer: options.producer,
      occurredAt: Date.now(),
      correlationId: options.correlationId,
    });

    options.onEvent?.(
      {
        type: "chat.message.error",
        correlationId: options.correlationId,
        error: buildRuntimeChatError(message, request.provider),
      },
      {
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        correlationId: options.correlationId,
      },
    );
  } finally {
    if (attachmentTempDir) {
      rm(attachmentTempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function startChatTurn(
  request: WorkspaceRuntimeChatTurnStartRequestPayload,
  options: StartChatTurnOptions = {},
): Promise<StartedChatTurn> {
  if (!isAllowedProvider(request.provider)) {
    throw new Error(
      "Missing or unsupported provider. Provider fallback is disabled.",
    );
  }

  console.log("[chat-service] startChatTurn entry", {
    provider: request.provider,
    model: request.model,
  });
  const correlationId =
    options.correlationId?.trim() ||
    request.correlationId?.trim() ||
    `chat-${nanoid()}`;
  const producer = options.producer ?? "chat-service";
  const threadService = createThreadService();
  const occurredAt = Date.now();
  const derivedThreadTitle =
    request.threadTitle ??
    (!request.threadId
      ? deriveThreadTitleFromMessage(request.message.content)
      : undefined);
  const threadContext = threadService.ensureThread({
    workspaceId: request.workspaceId,
    threadId: request.threadId,
    threadTitle: derivedThreadTitle,
    producer,
    occurredAt,
    correlationId,
  });
  const priorMessages = threadService.listMessagesByThreadId(
    threadContext.threadId,
  );
  const historySource = priorMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const systemPrompt = buildServerChatSystemPrompt();
  const history = historySource;

  threadService.recordMessage({
    workspaceId: threadContext.workspaceId,
    threadId: threadContext.threadId,
    role: "user",
    content: request.message.content,
    attachments: request.message.attachments,
    occurredAt,
    producer,
    correlationId,
  });

  const completion = executeChatTurn(request, {
    workspaceId: threadContext.workspaceId,
    threadId: threadContext.threadId,
    systemPrompt,
    history,
    correlationId,
    producer,
    runId: options.runId,
    onEvent: options.onEvent,
  });

  return {
    workspaceId: threadContext.workspaceId,
    threadId: threadContext.threadId,
    correlationId,
    completion,
  };
}
