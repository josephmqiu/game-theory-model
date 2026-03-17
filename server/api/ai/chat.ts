import {
  defineEventHandler,
  readBody,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import { z } from "zod";
import { resolveClaudeCli } from "../../utils/resolve-claude-cli";
import {
  buildClaudeAgentEnv,
  getClaudeAgentDebugFilePath,
} from "../../utils/resolve-claude-agent-env";
import { runCodexExec } from "../../utils/codex-client";
import type { AIStreamChunk } from "shared/game-theory/types/ai-stream";

const chatBodySchema = z.object({
  system: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
  model: z.string().min(1).optional(),
  provider: z.enum(["anthropic", "openai", "opencode", "copilot"]),
});

type ChatBody = z.infer<typeof chatBodySchema>;

const KEEPALIVE_INTERVAL_MS = 15_000;

function buildConversationPrompt(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n\n");
}

function writeChunk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: AIStreamChunk,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

function writeThinking(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  content: string,
): void {
  writeChunk(controller, encoder, { type: "thinking", content });
}

function parseOpenCodeModel(
  model?: string,
): { providerID: string; modelID: string } | undefined {
  if (!model || !model.includes("/")) return undefined;
  const index = model.indexOf("/");
  return {
    providerID: model.slice(0, index),
    modelID: model.slice(index + 1),
  };
}

function formatOpenCodeError(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  const value = error as Record<string, unknown>;
  if (typeof value.message === "string") return value.message;
  if (typeof value.name === "string" && value.data && typeof value.data === "object") {
    const data = value.data as Record<string, unknown>;
    if (typeof data.message === "string") {
      return `${value.name} — ${data.message}`;
    }
  }
  return JSON.stringify(error);
}

async function streamViaAgentSdk(body: ChatBody): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const pingTimer = setInterval(() => {
        try {
          writeChunk(controller, encoder, { type: "ping", content: "" });
        } catch {
          // Ignore stream closure.
        }
      }, KEEPALIVE_INTERVAL_MS);

      try {
        writeThinking(controller, encoder, "Connecting to Claude Code...");
        const { query } = await import("@anthropic-ai/claude-agent-sdk");
        const debugFile = getClaudeAgentDebugFilePath();
        const prompt = buildConversationPrompt(body.messages);
        writeThinking(controller, encoder, "Sending prompt to Anthropic...");
        const handle = query({
          prompt,
          options: {
            systemPrompt: body.system,
            ...(body.model ? { model: body.model } : {}),
            includePartialMessages: true,
            maxTurns: 1,
            tools: [],
            permissionMode: "plan",
            persistSession: false,
            env: buildClaudeAgentEnv(),
            ...(debugFile ? { debugFile } : {}),
            ...(resolveClaudeCli()
              ? { pathToClaudeCodeExecutable: resolveClaudeCli() }
              : {}),
          },
        });

        try {
          for await (const message of handle) {
            if (message.type === "stream_event") {
              const event = message.event;
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                clearInterval(pingTimer);
                writeChunk(controller, encoder, {
                  type: "text",
                  content: event.delta.text,
                });
              }
              if (
                event.type === "content_block_start" &&
                "content_block" in event &&
                typeof (event as { content_block?: { type?: string } }).content_block
                  ?.type === "string"
              ) {
                const blockType = (
                  event as { content_block?: { type?: string } }
                ).content_block?.type;
                if (blockType === "thinking") {
                  writeThinking(controller, encoder, "Model is reasoning...");
                }
              }
            } else if (message.type === "result") {
              const isErrorResult =
                "is_error" in message &&
                Boolean((message as { is_error?: boolean }).is_error);
              if (message.subtype !== "success" || isErrorResult) {
                writeChunk(controller, encoder, {
                  type: "error",
                  content:
                    ("result" in message && message.result) ||
                    `Claude query ended with ${message.subtype}`,
                });
              }
            }
          }
        } finally {
          handle.close();
        }

        writeChunk(controller, encoder, { type: "done", content: "" });
      } catch (error) {
        writeChunk(controller, encoder, {
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
}

async function streamViaCodex(body: ChatBody): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const pingTimer = setInterval(() => {
        try {
          writeChunk(controller, encoder, { type: "ping", content: "" });
        } catch {
          // Ignore stream closure.
        }
      }, KEEPALIVE_INTERVAL_MS);

      try {
        writeThinking(controller, encoder, "Starting Codex CLI...");
        const result = await runCodexExec(buildConversationPrompt(body.messages), {
          model: body.model,
          systemPrompt: body.system,
        });

        clearInterval(pingTimer);
        if (result.error) {
          writeChunk(controller, encoder, {
            type: "error",
            content: result.error,
          });
        } else if (result.text) {
          writeChunk(controller, encoder, {
            type: "text",
            content: result.text,
          });
          writeChunk(controller, encoder, { type: "done", content: "" });
        }
      } catch (error) {
        writeChunk(controller, encoder, {
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
}

async function streamViaOpenCode(body: ChatBody): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const pingTimer = setInterval(() => {
        try {
          writeChunk(controller, encoder, { type: "ping", content: "" });
        } catch {
          // Ignore stream closure.
        }
      }, KEEPALIVE_INTERVAL_MS);

      let ocServer: { close(): void } | undefined;
      try {
        writeThinking(controller, encoder, "Starting OpenCode session...");
        const { getOpencodeClient, releaseOpencodeServer } = await import(
          "../../utils/opencode-client"
        );
        const opencode = await getOpencodeClient();
        ocServer = opencode.server;
        const client = opencode.client;

        const { data: session, error: sessionError } = await client.session.create({
          title: "Game Theory Analyzer Chat",
        });
        if (sessionError || !session) {
          throw new Error(
            `Failed to create OpenCode session: ${formatOpenCodeError(sessionError)}`,
          );
        }

        await client.session.prompt({
          sessionID: session.id,
          noReply: true,
          parts: [{ type: "text", text: body.system }],
        });
        writeThinking(controller, encoder, "OpenCode session ready. Requesting response...");

        const eventResult = await client.event.subscribe();
        const eventStream = eventResult.stream;
        const parsedModel = parseOpenCodeModel(body.model);

        const { error: promptError } = await client.session.promptAsync({
          sessionID: session.id,
          ...(parsedModel ? { model: parsedModel } : {}),
          parts: [{ type: "text", text: buildConversationPrompt(body.messages) }],
        } as Record<string, unknown>);

        if (promptError) {
          throw new Error(formatOpenCodeError(promptError));
        }

        let emittedText = false;
        for await (const event of eventStream) {
          if (!event || !("type" in event)) continue;
          const eventType = (event as { type: string }).type;

          if (eventType === "message.part.delta") {
            const properties = (event as { properties?: Record<string, unknown> }).properties;
            if (
              properties?.sessionID === session.id &&
              properties.field === "text" &&
              typeof properties.delta === "string"
            ) {
              emittedText = true;
              clearInterval(pingTimer);
              writeChunk(controller, encoder, {
                type: "text",
                content: properties.delta,
              });
            }
            continue;
          }

          if (eventType === "session.error") {
            const properties = (event as { properties?: Record<string, unknown> }).properties;
            throw new Error(formatOpenCodeError(properties?.error));
          }

          if (
            eventType === "session.idle" &&
            (event as { properties?: Record<string, unknown> }).properties?.sessionID ===
              session.id
          ) {
            break;
          }
        }

        if (!emittedText) {
          writeChunk(controller, encoder, {
            type: "error",
            content: "OpenCode returned an empty response.",
          });
        } else {
          writeChunk(controller, encoder, { type: "done", content: "" });
        }

        releaseOpencodeServer(ocServer);
      } catch (error) {
        writeChunk(controller, encoder, {
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        if (ocServer) {
          const { releaseOpencodeServer } = await import(
            "../../utils/opencode-client"
          );
          releaseOpencodeServer(ocServer);
        }
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
}

async function streamViaCopilot(body: ChatBody): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const pingTimer = setInterval(() => {
        try {
          writeChunk(controller, encoder, { type: "ping", content: "" });
        } catch {
          // Ignore stream closure.
        }
      }, KEEPALIVE_INTERVAL_MS);

      let client: { stop(): Promise<unknown> } | undefined;
      try {
        writeThinking(controller, encoder, "Starting GitHub Copilot...");
        const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
        const { resolveCopilotCli } = await import("../../utils/copilot-client");
        client = new CopilotClient({
          autoStart: true,
          ...(resolveCopilotCli() ? { cliPath: resolveCopilotCli() } : {}),
        });

        await client.start();
        writeThinking(controller, encoder, "Copilot session created. Waiting for response...");
        const session = await client.createSession({
          ...(body.model ? { model: body.model } : {}),
          streaming: true,
          onPermissionRequest: approveAll,
          systemMessage: { mode: "replace", content: body.system },
        });

        session.on("assistant.message_delta", (event) => {
          const deltaContent = (event as { data?: { deltaContent?: string } }).data
            ?.deltaContent;
          if (deltaContent) {
            clearInterval(pingTimer);
            writeChunk(controller, encoder, {
              type: "text",
              content: deltaContent,
            });
          }
        });

        await session.sendAndWait(
          { prompt: buildConversationPrompt(body.messages) },
          120_000,
        );
        await session.destroy();
        writeChunk(controller, encoder, { type: "done", content: "" });
      } catch (error) {
        writeChunk(controller, encoder, {
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        clearInterval(pingTimer);
        if (client) {
          client.stop().catch(() => {});
        }
        controller.close();
      }
    },
  });

  return new Response(stream);
}

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = chatBodySchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    setResponseHeaders(event, { "Content-Type": "application/json" });
    return {
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }

  const body = parsed.data;

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (body.provider === "anthropic") return streamViaAgentSdk(body);
  if (body.provider === "openai") return streamViaCodex(body);
  if (body.provider === "opencode") return streamViaOpenCode(body);
  if (body.provider === "copilot") return streamViaCopilot(body);

  return { error: `Unsupported provider ${body.provider}` };
});
