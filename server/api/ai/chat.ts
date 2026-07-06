import {
  defineEventHandler,
  getRequestHeader,
  readBody,
  setResponseHeaders,
  setResponseStatus,
  type H3Event,
} from "h3";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { serverLog } from "../../utils/ai-logger";
import * as entityGraphService from "../../services/entity-graph-service";
import { streamChat as claudeStreamChat } from "../../services/ai/claude-adapter";
import {
  streamChat as codexStreamChat,
  isCodexThreadExpiredError,
} from "../../services/ai/codex-adapter";
import { streamChat as customStreamChat } from "../../services/ai/custom-openai-adapter";
import {
  beginTurn,
  endSession,
  endTurn,
  getOrCreateSession,
  markTurnActive,
  touch,
  type ChatSession,
  type StartedSessionTurn,
} from "../../services/ai/chat-sessions";
import {
  isAllowedProvider,
  type AllowedProvider,
} from "../../../shared/ai/allowed-providers";
import type {
  ChatAdapter,
  ChatProviderEntry,
  PreparedChatTurn,
} from "../../services/ai/adapter-types";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";
import { startSSEKeepAlive } from "../../utils/sse-keepalive";

/** Pattern for detecting sensitive data in debug log output */
export const SENSITIVE_LOG_PATTERN =
  /(?:\b[A-Z0-9_]*API[_-]?KEY\b\s*[:=]\s*|Authorization:\s*Bearer\s+)(?:"[^"]+"|'[^']+'|[^\s,;'"`]+)/i;

/** Allowed media types for image attachments */
export const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
export const MAX_CHAT_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_BASE64_LENGTH =
  Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;

/** Resolve file extension from media type, falling back to 'png' for disallowed types */
export function resolveMediaExtension(mediaType: string): string {
  return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType.split("/")[1] : "png";
}

function estimateBase64DecodedBytes(data: string): number {
  const normalized = data.replace(/\s/g, "");
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function isBase64Payload(data: string): boolean {
  const normalized = data.replace(/\s/g, "");
  return (
    normalized.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  );
}

export interface ChatAttachmentWire {
  name: string;
  mediaType: string;
  data: string; // base64
}

export interface ChatBody {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    attachments?: ChatAttachmentWire[];
  }>;
  model?: string;
  provider?: AllowedProvider;
  thinkingMode?: "adaptive" | "disabled" | "enabled";
  thinkingBudgetTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
  sessionKey?: string;
  custom?: CustomProviderRequest;
}

/** BYOK connection details sent by the renderer for the custom provider. */
export interface CustomProviderRequest {
  baseURL: string;
  apiKey: string;
  hasNativeWebSearch: boolean;
}

const customProviderSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string(),
  hasNativeWebSearch: z.boolean().optional().default(false),
});

const chatAttachmentSchema = z.object({
  name: z.string(),
  mediaType: z.string().refine((value) => ALLOWED_MEDIA_TYPES.has(value), {
    message: "Unsupported attachment media type",
  }),
  data: z
    .string()
    .max(MAX_ATTACHMENT_BASE64_LENGTH, "Attachment exceeds 5MiB")
    .superRefine((value, ctx) => {
      if (!isBase64Payload(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Attachment data must be base64",
        });
        return;
      }
      if (estimateBase64DecodedBytes(value) > MAX_ATTACHMENT_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Attachment exceeds 5MiB",
        });
      }
    }),
});

const chatBodySchema = z
  .object({
    system: z.string().trim().min(1),
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        attachments: z.array(chatAttachmentSchema).optional(),
      }),
    ),
    model: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    thinkingMode: z.enum(["adaptive", "disabled", "enabled"]).optional(),
    thinkingBudgetTokens: z.number().positive().optional(),
    effort: z.enum(["low", "medium", "high", "max"]).optional(),
    sessionKey: z.string().trim().min(1).optional(),
    custom: customProviderSchema.optional(),
  })
  .superRefine((body, ctx) => {
    // The custom provider needs its BYOK connection details on every request
    // (the server never caches them).
    if (body.provider === "custom" && !body.custom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom provider requires baseURL and apiKey",
        path: ["custom"],
      });
    }

    const attachments = body.messages.flatMap(
      (message) => message.attachments ?? [],
    );
    if (attachments.length > MAX_CHAT_ATTACHMENTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Too many attachments",
        path: ["messages"],
      });
    }

    const totalBytes = attachments.reduce(
      (sum, attachment) => sum + estimateBase64DecodedBytes(attachment.data),
      0,
    );
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Attachments exceed total size limit",
        path: ["messages"],
      });
    }
  });

function writeSSE(
  controller: ReadableStreamDefaultController,
  payload: unknown,
) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`),
  );
}

function badRequest(event: H3Event, error: string) {
  setResponseStatus(event, 400);
  setResponseHeaders(event, { "Content-Type": "application/json" });
  return { error };
}

function conflict(event: H3Event, error: string) {
  setResponseStatus(event, 409);
  setResponseHeaders(event, { "Content-Type": "application/json" });
  return { error };
}

function shouldForwardChatEvent(type: string): boolean {
  return (
    type === "text_delta" ||
    type === "tool_call_start" ||
    type === "tool_call_result" ||
    type === "tool_call_error" ||
    type === "session_expired" ||
    type === "error"
  );
}

/**
 * Streaming chat endpoint.
 * Routes to the appropriate provider SDK based on the `provider` field.
 * Requires explicit provider and model; no fallback routing.
 */
export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody<unknown>(event);
  } catch {
    return badRequest(event, "Invalid request body");
  }
  const runId = getRequestHeader(event, "x-run-id")?.trim() || undefined;
  const parsedBody = chatBodySchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return badRequest(
      event,
      "Missing or invalid required fields: system, messages, provider, model",
    );
  }
  const parsed = parsedBody.data;
  // A provider must be both allowlisted and registered in the routing table.
  // An allowlisted-but-unregistered provider (e.g. "custom" before its adapter
  // ships) falls through to the same rejection as a disallowed provider.
  if (!isAllowedProvider(parsed.provider)) {
    return badRequest(
      event,
      "Missing or unsupported provider. Provider fallback is disabled.",
    );
  }
  const entry = CHAT_PROVIDERS[parsed.provider];
  if (!entry) {
    return badRequest(
      event,
      "Missing or unsupported provider. Provider fallback is disabled.",
    );
  }
  const body: ChatBody = {
    ...parsed,
    provider: parsed.provider,
  };

  const provider = parsed.provider;
  const model = body.model;
  const systemLen = body.system.length;
  const messageLen = body.messages.reduce(
    (n, m) => n + (m.content?.length ?? 0),
    0,
  );
  serverLog(runId, "chat", "request-received", {
    provider,
    model,
    systemLen,
    messageLen,
  });

  const sessionTurn = body.sessionKey
    ? beginTurn(body.sessionKey, provider)
    : null;
  if (sessionTurn && !sessionTurn.started) {
    return conflict(event, "A turn is already streaming for this session");
  }
  const startedSessionTurn = sessionTurn?.started ? sessionTurn : null;

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Dispatch via the provider routing table; no fallback routing.
  const prepared = entry.prepare(body, startedSessionTurn);
  return entry.stream({
    event,
    body,
    model: body.model,
    runId,
    sessionResult: startedSessionTurn,
    prepared,
    adapter: entry.adapter,
  });
});

/** Inputs a provider's stream() wrapper receives for one chat turn. */
interface ChatStreamContext {
  event: H3Event;
  body: ChatBody;
  model?: string;
  runId?: string;
  sessionResult: StartedSessionTurn | null;
  prepared: PreparedChatTurn;
  adapter: ChatAdapter;
}

/**
 * Build the prompt/system parts for a turn. Runtime sessions keep the system
 * prompt lean; a provider switch or the no-session legacy path folds history in.
 */
function prepareChatTurn(
  body: Pick<ChatBody, "system" | "messages" | "sessionKey">,
  sessionResult: StartedSessionTurn | null,
): PreparedChatTurn {
  return body.sessionKey
    ? sessionResult?.providerChanged
      ? buildLegacyChatPromptParts(body)
      : buildRuntimeSessionPromptParts(body)
    : buildLegacyChatPromptParts(body);
}

const CUSTOM_CHAT_ADAPTER_STUB: ChatAdapter = {
  // eslint-disable-next-line require-yield
  async *streamChat(): AsyncGenerator<never> {
    throw new Error(
      "custom provider is dispatched via streamViaCustom, not adapter.streamChat",
    );
  },
};

/**
 * Provider routing table. Partial: an allowlisted provider without an entry
 * (e.g. "custom" before its adapter ships) is rejected by the handler.
 */
const CHAT_PROVIDERS: Partial<
  Record<AllowedProvider, ChatProviderEntry<ChatStreamContext>>
> = {
  anthropic: {
    adapter: { streamChat: claudeStreamChat },
    prepare: prepareChatTurn,
    stream: streamViaClaude,
  },
  openai: {
    adapter: { streamChat: codexStreamChat },
    prepare: prepareChatTurn,
    stream: streamViaCodexAdapter,
  },
  custom: {
    // The custom provider dispatches via streamViaCustom, which consumes the
    // FULL multi-turn history from ctx.body.messages plus the per-request BYOK
    // creds — neither fits the base ChatAdapter(prompt, system, model) shape —
    // so this adapter field is never invoked.
    adapter: CUSTOM_CHAT_ADAPTER_STUB,
    prepare: prepareChatTurn,
    stream: streamViaCustom,
  },
};

/** Stream via the custom OpenAI-compatible adapter — wraps it into SSE. */
function streamViaCustom(ctx: ChatStreamContext): Response {
  const { event, body, model, runId } = ctx;
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      const startPingTimer = () => {
        if (pingTimer) return;
        pingTimer = startSSEKeepAlive(
          () => writeSSE(controller, { type: "ping", content: "" }),
          KEEPALIVE_INTERVAL_MS,
        );
      };
      const stopPingTimer = () => {
        if (!pingTimer) return;
        clearInterval(pingTimer);
        pingTimer = null;
      };

      const req = event.node?.req;
      if (req) {
        req.on("close", () => abortController.abort());
      }

      try {
        const custom = body.custom;
        if (!custom) {
          // Guarded by zod superRefine, but stay defensive.
          throw new Error("Custom provider requires baseURL and apiKey");
        }

        startPingTimer();

        for await (const ev of customStreamChat(
          {
            system: body.system,
            messages: body.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            model: model ?? "gpt-4o-mini",
            baseURL: custom.baseURL,
            apiKey: custom.apiKey,
            hasNativeWebSearch: custom.hasNativeWebSearch,
          },
          { runId, signal: abortController.signal },
        )) {
          stopPingTimer();
          if (shouldForwardChatEvent(ev.type)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(ev)}\n\n`),
            );
          }
        }

        serverLog(runId, "chat", "stream-complete");
        const customAnalysis = entityGraphService.getAnalysis();
        if (customAnalysis.entities.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "entity_snapshot", analysis: customAnalysis })}\n\n`,
            ),
          );
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: "" })}\n\n`,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        serverLog(runId, "chat", "stream-error", { error: message });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message, recoverable: false })}\n\n`,
          ),
        );
      } finally {
        stopPingTimer();
        if (body.sessionKey) {
          endTurn(body.sessionKey);
        }
        controller.close();
      }
    },
  });

  return new Response(stream);
}

/** Stream via Codex adapter — wraps the adapter's streamChat() into SSE */
function streamViaCodexAdapter(ctx: ChatStreamContext): Response {
  const { event, body, model, runId, sessionResult, prepared, adapter } = ctx;
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      const startPingTimer = () => {
        if (pingTimer) return;
        pingTimer = startSSEKeepAlive(
          () => writeSSE(controller, { type: "ping", content: "" }),
          KEEPALIVE_INTERVAL_MS,
        );
      };
      const stopPingTimer = () => {
        if (!pingTimer) return;
        clearInterval(pingTimer);
        pingTimer = null;
      };

      // Detect client disconnect and cancel the adapter
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      try {
        let session: ChatSession | null = sessionResult?.session ?? null;

        if (sessionResult?.expired || sessionResult?.providerChanged) {
          writeSSE(controller, { type: "session_expired" });
        }
        startPingTimer();

        const { prompt, systemPrompt } = prepared;

        const streamFreshCodexTurn = async () => {
          for await (const ev of adapter.streamChat(
            prompt,
            systemPrompt,
            model ?? "o3-mini",
            {
              runId,
              signal: abortController.signal,
              ...(session?.codexThreadId
                ? { existingThreadId: session.codexThreadId }
                : {}),
              ...(session
                ? {
                    onThreadId: (threadId: string) => {
                      if (!session) return;
                      session.codexThreadId = threadId;
                      touch(session.key);
                    },
                  }
                : {}),
            },
          )) {
            stopPingTimer();
            // Emit ChatEvent objects directly — client normalizeChunk() handles them
            if (shouldForwardChatEvent(ev.type)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(ev)}\n\n`),
              );
            }
            // turn_complete is handled after the loop
          }
          if (session) {
            touch(session.key);
          }
        };

        try {
          await streamFreshCodexTurn();
        } catch (error) {
          if (!body.sessionKey || !isCodexThreadExpiredError(error)) {
            throw error;
          }
          endSession(body.sessionKey);
          session = getOrCreateSession(body.sessionKey, "openai").session;
          markTurnActive(body.sessionKey);
          writeSSE(controller, { type: "session_expired" });
          startPingTimer();
          await streamFreshCodexTurn();
        }

        serverLog(runId, "chat", "stream-complete");
        const codexAnalysis = entityGraphService.getAnalysis();
        if (codexAnalysis.entities.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "entity_snapshot", analysis: codexAnalysis })}\n\n`,
            ),
          );
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: "" })}\n\n`,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        serverLog(runId, "chat", "stream-error", { error: message });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message, recoverable: false })}\n\n`,
          ),
        );
      } finally {
        stopPingTimer();
        if (body.sessionKey) {
          endTurn(body.sessionKey);
        }
        controller.close();
      }
    },
  });

  return new Response(stream);
}

/** Stream via Claude adapter — wraps the adapter's streamChat() into SSE */
function streamViaClaude(ctx: ChatStreamContext): Response {
  const { event, body, model, runId, sessionResult, prepared, adapter } = ctx;
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let pingTimer: ReturnType<typeof setInterval> | null = null;
      const startPingTimer = () => {
        if (pingTimer) return;
        pingTimer = startSSEKeepAlive(
          () => writeSSE(controller, { type: "ping", content: "" }),
          KEEPALIVE_INTERVAL_MS,
        );
      };
      const stopPingTimer = () => {
        if (!pingTimer) return;
        clearInterval(pingTimer);
        pingTimer = null;
      };

      let attachTempDir: string | undefined;

      // Detect client disconnect and cancel the adapter
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      try {
        const session: ChatSession | null = sessionResult?.session ?? null;

        if (sessionResult?.expired || sessionResult?.providerChanged) {
          writeSSE(controller, { type: "session_expired" });
        }
        startPingTimer();

        const promptParts = prepared;
        let prompt = promptParts.prompt;

        // Save image attachments to temp files inside the project directory
        // so Claude Code Agent SDK (which restricts reads to the project
        // directory in plan mode) can access them.
        const attachments = getLastUserAttachments(body);
        if (attachments.length > 0) {
          const saved = await saveAttachmentsToTempFiles(attachments);
          attachTempDir = saved.tempDir;
          const imageRefs = saved.files
            .map(
              (f) =>
                `First, use the Read tool to read the image file at "${f}". Then analyze it and respond to the user.`,
            )
            .join("\n");
          prompt =
            imageRefs +
            "\n\n" +
            (prompt || "Describe what you see in the image.");
        }

        for await (const ev of adapter.streamChat(
          prompt,
          promptParts.systemPrompt,
          model ?? "claude-sonnet-4-6",
          {
            runId,
            signal: abortController.signal,
            ...(session?.claudeSessionId
              ? { resumeSessionId: session.claudeSessionId }
              : {}),
            ...(session
              ? {
                  onSessionId: (sessionId: string) => {
                    if (!session) return;
                    session.claudeSessionId = sessionId;
                    touch(session.key);
                  },
                }
              : {}),
          },
        )) {
          stopPingTimer();
          // Emit ChatEvent objects directly — client normalizeChunk() handles them
          if (shouldForwardChatEvent(ev.type)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(ev)}\n\n`),
            );
          }
          // turn_complete is handled after the loop
        }
        if (session) {
          touch(session.key);
        }

        serverLog(runId, "chat", "stream-complete");
        const claudeAnalysis = entityGraphService.getAnalysis();
        if (claudeAnalysis.entities.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "entity_snapshot", analysis: claudeAnalysis })}\n\n`,
            ),
          );
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: "" })}\n\n`,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        serverLog(runId, "chat", "stream-error", { error: message });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message, recoverable: false })}\n\n`,
          ),
        );
      } finally {
        stopPingTimer();
        if (body.sessionKey) {
          endTurn(body.sessionKey);
        }
        if (attachTempDir) {
          rm(attachTempDir, { recursive: true, force: true }).catch((error) => {
            serverLog(runId, "chat", "attachment-cleanup-failed", {
              error: error instanceof Error ? error.message : String(error),
              tempDir: attachTempDir,
            });
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream);
}

// Keep-alive ping interval (ms) — prevents client timeout while waiting for API TTFT
const KEEPALIVE_INTERVAL_MS =
  analysisRuntimeConfig.analyzeSse.keepaliveIntervalMs;

function getLastUserPrompt(body: Pick<ChatBody, "messages">): string {
  const lastUserMsg = [...body.messages]
    .reverse()
    .find((m) => m.role === "user");
  return lastUserMsg?.content ?? "";
}

export function buildLegacyChatPromptParts(
  body: Pick<ChatBody, "system" | "messages">,
): { prompt: string; systemPrompt: string } {
  return {
    prompt: getLastUserPrompt(body),
    systemPrompt: buildEffectiveSystemPrompt(body),
  };
}

export function buildRuntimeSessionPromptParts(
  body: Pick<ChatBody, "system" | "messages">,
): { prompt: string; systemPrompt: string } {
  return {
    prompt: getLastUserPrompt(body),
    systemPrompt: body.system,
  };
}

/**
 * Inject conversation history into the system prompt for the legacy no-session
 * path. Runtime sessions deliberately bypass this helper.
 */
export function buildEffectiveSystemPrompt(
  body: Pick<ChatBody, "system" | "messages">,
): string {
  // All messages except the last user message form the conversation context
  const contextMessages = body.messages.slice(0, -1);
  if (contextMessages.length === 0) return body.system;

  const conversationContext = contextMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  return `${body.system}\n\n## Conversation History\n\n${conversationContext}`;
}

/**
 * Save base64 attachments to temp files. Returns { tempDir, files[] } — caller must clean up tempDir.
 *
 * Files are saved under `.game-theory-analyzer-tmp/` in the current working
 * directory so Claude Code Agent SDK can read them in plan mode.
 */
async function saveAttachmentsToTempFiles(
  attachments: ChatAttachmentWire[],
): Promise<{ tempDir: string; files: string[] }> {
  const { mkdirSync, chmodSync } = await import("node:fs");
  const baseDir = join(process.cwd(), ".game-theory-analyzer-tmp");
  mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  chmodSync(baseDir, 0o700);
  const tempDir = await mkdtemp(join(baseDir, "attach-"));
  const files: string[] = [];
  for (const att of attachments) {
    const ext = resolveMediaExtension(att.mediaType);
    const filePath = join(tempDir, `${files.length}.${ext}`);
    await writeFile(filePath, Buffer.from(att.data, "base64"));
    files.push(filePath);
  }
  return { tempDir, files };
}

/** Collect all attachments from the last user message */
function getLastUserAttachments(body: ChatBody): ChatAttachmentWire[] {
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  return lastUser?.attachments ?? [];
}

/** Error name → user-friendly label mapping */
const OPENCODE_ERROR_LABELS: Record<string, string> = {
  APIError: "API error",
  ProviderAuthError: "Authentication failed",
  UnknownError: "Unknown error",
  MessageOutputLengthError: "Response too long",
  MessageAbortedError: "Request aborted",
  StructuredOutputError: "Output format error",
  ContextOverflowError: "Context too long",
};

/**
 * Extract a human-readable message from an OpenCode error object.
 * Handles structured errors like { name: "APIError", data: { message: "..." } }
 * and nested JSON in message strings.
 */
export function formatOpenCodeError(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;

  const err = error as Record<string, any>;

  // Structured OpenCode error: { name, data: { message, ... } }
  if (err.name && err.data?.message) {
    const label = OPENCODE_ERROR_LABELS[err.name] ?? err.name;
    let msg: string = err.data.message;

    // Try to extract nested error message from JSON in the message string
    // e.g. 'Unauthorized: {"error":{"code":"invalid_api_key","message":"invalid access token"}}'
    const jsonStart = msg.indexOf("{");
    if (jsonStart > 0) {
      try {
        const nested = JSON.parse(msg.slice(jsonStart));
        const nestedMsg = nested?.error?.message ?? nested?.message;
        if (nestedMsg) {
          const prefix = msg.slice(0, jsonStart).replace(/:\s*$/, "").trim();
          msg = prefix ? `${prefix}: ${nestedMsg}` : nestedMsg;
        }
      } catch {
        /* not JSON, use as-is */
      }
    }

    return `${label} — ${msg}`;
  }

  // Plain { message } object
  if (err.message) return err.message;

  // Fallback: truncated JSON
  const json = JSON.stringify(error);
  return json.length > 200 ? json.slice(0, 200) + "…" : json;
}
