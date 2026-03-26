import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { H3Event } from "h3";
import { z } from "zod";
import * as entityGraphService from "../entity-graph-service";
import {
  createThreadService,
  deriveThreadTitleFromMessage,
} from "../workspace/thread-service";
import { getProviderSessionBinding } from "../workspace/provider-session-binding-service";
import { createProcessRuntimeError } from "../../../shared/types/runtime-error";
import { trimChatHistory } from "../../../shared/utils/trim-chat-history";
import type { ChatEvent } from "../../../shared/types/events";
import { getRuntimeAdapter } from "./adapter-contract";

export const ALLOWED_PROVIDERS = ["anthropic", "openai"] as const;
const KEEPALIVE_INTERVAL_MS = 15_000;
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

export interface CanonicalChatRequest {
  workspaceId?: string;
  threadId?: string;
  threadTitle?: string;
  message: {
    content: string;
    attachments?: ChatAttachmentWire[];
  };
  provider: "anthropic" | "openai";
  model: string;
  thinkingMode?: "adaptive" | "disabled" | "enabled";
  thinkingBudgetTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
  compatibility?: {
    system?: string;
    messages?: Array<{
      role: "user" | "assistant";
      content: string;
      attachments?: ChatAttachmentWire[];
    }>;
  };
}

const chatAttachmentSchema = z.object({
  name: z.string(),
  mediaType: z.string(),
  data: z.string(),
});

const canonicalChatRequestSchema = z.object({
  workspaceId: z.string().trim().min(1).optional(),
  threadId: z.string().trim().min(1).optional(),
  threadTitle: z.string().trim().min(1).optional(),
  message: z.object({
    content: z.string(),
    attachments: z.array(chatAttachmentSchema).optional(),
  }),
  provider: z.enum(ALLOWED_PROVIDERS),
  model: z.string().trim().min(1),
  thinkingMode: z.enum(["adaptive", "disabled", "enabled"]).optional(),
  thinkingBudgetTokens: z.number().positive().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
});

const legacyChatRequestSchema = z.object({
  system: z.string().trim().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      attachments: z.array(chatAttachmentSchema).optional(),
    }),
  ),
  model: z.string().trim().min(1),
  provider: z.enum(ALLOWED_PROVIDERS),
  thinkingMode: z.enum(["adaptive", "disabled", "enabled"]).optional(),
  thinkingBudgetTokens: z.number().positive().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  threadId: z.string().trim().min(1).optional(),
  threadTitle: z.string().trim().min(1).optional(),
});

export function normalizeChatRequest(raw: unknown): CanonicalChatRequest {
  const canonical = canonicalChatRequestSchema.safeParse(raw);
  if (canonical.success) {
    return canonical.data;
  }

  const legacy = legacyChatRequestSchema.safeParse(raw);
  if (!legacy.success) {
    throw new Error("Missing or invalid required fields for chat request.");
  }

  const lastUserMessage = [...legacy.data.messages]
    .reverse()
    .find((message) => message.role === "user");
  if (!lastUserMessage) {
    throw new Error("Legacy chat requests require at least one user message.");
  }

  return {
    workspaceId: legacy.data.workspaceId,
    threadId: legacy.data.threadId,
    threadTitle: legacy.data.threadTitle,
    message: {
      content: lastUserMessage.content,
      attachments: lastUserMessage.attachments,
    },
    provider: legacy.data.provider,
    model: legacy.data.model,
    thinkingMode: legacy.data.thinkingMode,
    thinkingBudgetTokens: legacy.data.thinkingBudgetTokens,
    effort: legacy.data.effort,
    compatibility: {
      system: legacy.data.system,
      messages: legacy.data.messages.slice(0, -1),
    },
  };
}

function isAllowedProvider(
  provider: string,
): provider is (typeof ALLOWED_PROVIDERS)[number] {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(provider);
}

function buildServerChatSystemPrompt(): string {
  const analysis = entityGraphService.getAnalysis();
  const hasCanvasAnalysis =
    analysis.topic.trim().length > 0 || analysis.entities.length > 0;

  const basePrompt = hasCanvasAnalysis
    ? `You are a game theory analyst assistant. You help the user understand the entity graph analysis displayed on the canvas.

You have access to the current analysis context including entities (facts, players, objectives, games, strategies, payoffs, institutional rules, escalation rungs), their relationships, and which methodology phases are complete.

Answer questions about the analysis, explain game-theoretic concepts, and help the user interpret the results. Do not start or rerun analysis unless the user explicitly asks you to do so or clearly confirms they are ready. Be concise and precise.`
    : `You are a game theory analyst assistant. The canvas is currently blank.

Help the user figure out what they want to analyze. Clarify the situation, identify the likely actors, decisions, incentives, and strategic conflict, and suggest concise next questions when useful.

Do not start or rerun analysis unless the user explicitly asks you to do so or clearly confirms they are ready to run it.

Be concise, practical, and collaborative.`;

  const phaseStatuses = analysis.phases
    .map((phaseStatus) => `${phaseStatus.phase}: ${phaseStatus.status}`)
    .join(", ");
  const entitySummary = analysis.entities
    .slice(0, 30)
    .map((entity) => {
      const data = entity.data;
      const label =
        "name" in data
          ? data.name
          : "content" in data
            ? data.content
            : entity.type;
      return `- [${entity.type}] ${label} (${entity.confidence} confidence, phase: ${entity.phase})`;
    })
    .join("\n");

  const context = [
    "ANALYSIS CONTEXT:",
    `Topic: ${analysis.topic || "(no topic)"}`,
    `Name: ${analysis.name || "(unnamed)"}`,
    `Entities: ${analysis.entities.length}`,
    `Phases: ${phaseStatuses}`,
    analysis.entities.length > 0 ? `\nEntities:\n${entitySummary}` : "",
    analysis.centralThesis ? `\nCentral Thesis: ${analysis.centralThesis}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${basePrompt}\n\n${context}`;
}

/**
 * TRANSITIONAL: Stuffs bounded conversation history into the system prompt.
 * This will be replaced by native multi-turn message arrays once the
 * renderer stops sending compatibility.messages and the server thread
 * owns the full conversation context.
 */
function buildEffectiveSystemPrompt(input: {
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  if (input.history.length === 0) {
    return input.systemPrompt;
  }

  const conversationContext = input.history
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");

  return `${input.systemPrompt}\n\n## Conversation History\n\n${conversationContext}`;
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

export async function createChatResponse(
  event: H3Event,
  request: CanonicalChatRequest,
  runId?: string,
): Promise<Response> {
  if (!isAllowedProvider(request.provider)) {
    throw new Error(
      "Missing or unsupported provider. Provider fallback is disabled.",
    );
  }

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
    producer: "chat-service",
    occurredAt,
  });
  // Durable thread messages take precedence over legacy compatibility history.
  // If a thread was established by a prior canonical request, legacy fallback
  // history from compatibility.messages is intentionally ignored — the durable
  // store is the source of truth. This means a mid-session upgrade from legacy
  // to canonical requests will lose the pre-upgrade history that wasn't persisted.
  const priorMessages = threadService.listMessagesByThreadId(
    threadContext.threadId,
  );
  const fallbackHistory = request.compatibility?.messages ?? [];
  const historySource =
    priorMessages.length > 0
      ? priorMessages.map((message) => ({
          role: message.role,
          content: message.content,
        }))
      : fallbackHistory.map((message) => ({
          role: message.role,
          content: message.content,
        }));
  const systemPromptBase =
    request.compatibility?.system?.trim() || buildServerChatSystemPrompt();
  const boundedHistory = trimChatHistory(
    historySource,
    undefined,
    undefined,
    systemPromptBase.length,
  );
  const systemPrompt = buildEffectiveSystemPrompt({
    systemPrompt: systemPromptBase,
    history: boundedHistory,
  });

  threadService.recordMessage({
    workspaceId: threadContext.workspaceId,
    threadId: threadContext.threadId,
    role: "user",
    content: request.message.content,
    attachments: request.message.attachments,
    occurredAt,
    producer: "chat-service",
  });

  const abortController = new AbortController();
  const pendingToolMetadata = new Map<string, Array<{ query?: string }>>();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const pingTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "ping", content: "" })}\n\n`,
            ),
          );
        } catch {
          // Stream already closed.
        }
      }, KEEPALIVE_INTERVAL_MS);

      let accumulated = "";
      let attachmentTempDir: string | undefined;
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      try {
        let prompt = request.message.content;
        if (
          request.provider === "anthropic" &&
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
            imageRefs +
            "\n\n" +
            (prompt || "Describe what you see in the image.");
        }

        const adapter = await getRuntimeAdapter(request.provider);
        const session = adapter.createSession(
          {
            workspaceId: threadContext.workspaceId,
            threadId: threadContext.threadId,
            ...(runId ? { runId } : {}),
            purpose: "chat",
          },
          getProviderSessionBinding(threadContext.threadId, "chat"),
        );

        const effectiveSystemPrompt =
          request.provider === "anthropic" &&
          request.message.attachments &&
          request.message.attachments.length > 0
            ? stripNoToolsRestriction(systemPrompt)
            : systemPrompt;

        try {
          for await (const eventChunk of session.streamChatTurn({
            prompt,
            systemPrompt: effectiveSystemPrompt,
            model: request.model,
            runId,
            signal: abortController.signal,
          })) {
            clearInterval(pingTimer);

            if (eventChunk.type === "text_delta") {
              accumulated += eventChunk.content;
            }

            if (eventChunk.type === "tool_call_start") {
              const queue = pendingToolMetadata.get(eventChunk.toolName) ?? [];
              queue.push({
                query: extractQueryFromToolInput(eventChunk.input),
              });
              pendingToolMetadata.set(eventChunk.toolName, queue);
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
                workspaceId: threadContext.workspaceId,
                threadId: threadContext.threadId,
                scope: "chat-turn",
                kind,
                message:
                  eventChunk.type === "tool_call_error"
                    ? `Tool ${eventChunk.toolName} failed: ${eventChunk.error}`
                    : `Used ${eventChunk.toolName}`,
                status:
                  eventChunk.type === "tool_call_error"
                    ? "failed"
                    : "completed",
                toolName: eventChunk.toolName,
                query,
                producer: "chat-service",
                occurredAt: Date.now(),
              });
            }

            if (
              eventChunk.type === "text_delta" ||
              eventChunk.type === "tool_call_start" ||
              eventChunk.type === "tool_call_result" ||
              eventChunk.type === "tool_call_error" ||
              eventChunk.type === "error"
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(eventChunk)}\n\n`),
              );
            }
          }
        } finally {
          const diagnostics = session.getDiagnostics();
          const recovery = diagnostics.recovery;
          if (recovery) {
            threadService.recordActivity({
              workspaceId: threadContext.workspaceId,
              threadId: threadContext.threadId,
              scope: "chat-turn",
              kind: "note",
              message:
                recovery.disposition === "resumed"
                  ? `${request.provider === "openai" ? "Codex app-server" : "Claude Code"} resumed persisted provider session`
                  : (recovery.message ??
                    `${request.provider === "openai" ? "Codex app-server" : "Claude Code"} started a fresh provider session`),
              status:
                recovery.disposition === "fallback" ? "failed" : "completed",
              producer: "chat-service",
              occurredAt: recovery.timestamp,
            });
          }
          await session.dispose();
        }

        if (accumulated.trim().length > 0) {
          threadService.recordMessage({
            workspaceId: threadContext.workspaceId,
            threadId: threadContext.threadId,
            role: "assistant",
            content: accumulated,
            messageId: `msg-${nanoid()}`,
            occurredAt: Date.now(),
            producer: "chat-service",
          });
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: "" })}\n\n`,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        if (accumulated.trim().length > 0) {
          threadService.recordMessage({
            workspaceId: threadContext.workspaceId,
            threadId: threadContext.threadId,
            role: "assistant",
            content: accumulated,
            occurredAt: Date.now(),
            producer: "chat-service",
          });
        }

        threadService.recordActivity({
          workspaceId: threadContext.workspaceId,
          threadId: threadContext.threadId,
          scope: "chat-turn",
          kind: "note",
          message,
          status: "failed",
          producer: "chat-service",
          occurredAt: Date.now(),
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              error: createProcessRuntimeError(message, {
                provider: request.provider === "openai" ? "codex" : "claude",
                processState: "failed-to-start",
                retryable: false,
              }),
            } satisfies ChatEvent)}\n\n`,
          ),
        );
      } finally {
        clearInterval(pingTimer);
        if (attachmentTempDir) {
          rm(attachmentTempDir, { recursive: true, force: true }).catch(
            () => {},
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Workspace-Id": threadContext.workspaceId,
      "X-Thread-Id": threadContext.threadId,
    },
  });
}
