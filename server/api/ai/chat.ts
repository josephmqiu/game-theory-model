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
import { streamChat as codexStreamChat } from "../../services/ai/codex-adapter";

const ALLOWED_PROVIDERS = ["anthropic", "openai"] as const;

function isAllowedProvider(
  provider: string,
): provider is (typeof ALLOWED_PROVIDERS)[number] {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(provider);
}

/** Pattern for detecting sensitive data in debug log output */
export const SENSITIVE_LOG_PATTERN =
  /ANTHROPIC_API_KEY=|Authorization:\s*Bearer|api[_-]?key\s*[:=]/i;

/** Allowed media types for image attachments */
export const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Resolve file extension from media type, falling back to 'png' for disallowed types */
export function resolveMediaExtension(mediaType: string): string {
  return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType.split("/")[1] : "png";
}

interface ChatAttachmentWire {
  name: string;
  mediaType: string;
  data: string; // base64
}

interface ChatBody {
  system: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    attachments?: ChatAttachmentWire[];
  }>;
  model?: string;
  provider?: "anthropic" | "openai";
  thinkingMode?: "adaptive" | "disabled" | "enabled";
  thinkingBudgetTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
}

const chatAttachmentSchema = z.object({
  name: z.string(),
  mediaType: z.string(),
  data: z.string(),
});

const chatBodySchema = z.object({
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
});

function badRequest(event: H3Event, error: string) {
  setResponseStatus(event, 400);
  setResponseHeaders(event, { "Content-Type": "application/json" });
  return { error };
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
  if (!isAllowedProvider(parsed.provider)) {
    return badRequest(
      event,
      "Missing or unsupported provider. Provider fallback is disabled.",
    );
  }
  const body: ChatBody = {
    ...parsed,
    provider: parsed.provider,
  };

  const provider = body.provider;
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

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Route to allowed providers only; no fallback routing.
  if (body.provider === "anthropic")
    return streamViaClaude(event, body, body.model, runId);
  return streamViaCodexAdapter(event, body, body.model, runId);
});

/** Stream via Codex adapter — wraps codex-adapter.streamChat() into SSE */
function streamViaCodexAdapter(
  event: H3Event,
  body: ChatBody,
  model?: string,
  runId?: string,
) {
  const abortController = new AbortController();

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
          /* stream already closed */
        }
      }, KEEPALIVE_INTERVAL_MS);

      // Detect client disconnect and cancel the adapter
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      try {
        const lastUserMsg = [...body.messages]
          .reverse()
          .find((m) => m.role === "user");
        const prompt = lastUserMsg?.content ?? "";

        // Inject conversation history into system prompt so multi-turn
        // context survives the single-prompt SDK limitation.
        const effectiveSystemPrompt = buildEffectiveSystemPrompt(body);

        for await (const ev of codexStreamChat(
          prompt,
          effectiveSystemPrompt,
          model ?? "o3-mini",
          { runId, signal: abortController.signal },
        )) {
          clearInterval(pingTimer);
          // Emit ChatEvent objects directly — client normalizeChunk() handles them
          if (
            ev.type === "text_delta" ||
            ev.type === "tool_call_start" ||
            ev.type === "tool_call_result" ||
            ev.type === "tool_call_error" ||
            ev.type === "error"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(ev)}\n\n`),
            );
          }
          // turn_complete is handled after the loop
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
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
}

/** Stream via Claude adapter — wraps claude-adapter.streamChat() into SSE */
function streamViaClaude(
  event: H3Event,
  body: ChatBody,
  model?: string,
  runId?: string,
) {
  const abortController = new AbortController();

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
          /* stream already closed */
        }
      }, KEEPALIVE_INTERVAL_MS);

      let attachTempDir: string | undefined;

      // Detect client disconnect and cancel the adapter
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      try {
        const lastUserMsg = [...body.messages]
          .reverse()
          .find((m) => m.role === "user");
        let prompt = lastUserMsg?.content ?? "";

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

        // Inject conversation history into system prompt so multi-turn
        // context survives the single-prompt SDK limitation.
        const effectiveSystemPrompt = buildEffectiveSystemPrompt(body);

        for await (const ev of claudeStreamChat(
          prompt,
          effectiveSystemPrompt,
          model ?? "claude-sonnet-4-6",
          { runId, signal: abortController.signal },
        )) {
          clearInterval(pingTimer);
          // Emit ChatEvent objects directly — client normalizeChunk() handles them
          if (
            ev.type === "text_delta" ||
            ev.type === "tool_call_start" ||
            ev.type === "tool_call_result" ||
            ev.type === "tool_call_error" ||
            ev.type === "error"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(ev)}\n\n`),
            );
          }
          // turn_complete is handled after the loop
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
        clearInterval(pingTimer);
        if (attachTempDir) {
          rm(attachTempDir, { recursive: true, force: true }).catch(() => {});
        }
        controller.close();
      }
    },
  });

  return new Response(stream);
}

// Keep-alive ping interval (ms) — prevents client timeout while waiting for API TTFT
const KEEPALIVE_INTERVAL_MS = 15_000;

/**
 * Inject conversation history into the system prompt so multi-turn context
 * survives the single-prompt limitation of both the Claude Agent SDK and
 * Codex app-server JSON-RPC interface.
 */
function buildEffectiveSystemPrompt(body: ChatBody): string {
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
