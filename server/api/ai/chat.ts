import {
  defineEventHandler,
  readBody,
  setResponseStatus,
  setResponseHeaders,
} from "h3";
import Anthropic from "@anthropic-ai/sdk";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  system: string;
  messages: ChatMessage[];
  model?: string;
}

const KEEPALIVE_INTERVAL_MS = 15_000;
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Streaming chat endpoint.
 * Uses the Anthropic SDK to stream responses in SSE format.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ChatBody>(event);

  if (!body?.messages || !body?.system) {
    setResponseStatus(event, 400);
    setResponseHeaders(event, { "Content-Type": "application/json" });
    return { error: "Missing required fields: system, messages" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    setResponseStatus(event, 500);
    setResponseHeaders(event, { "Content-Type": "application/json" });
    return { error: "ANTHROPIC_API_KEY not configured" };
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const model = body.model?.trim() || DEFAULT_MODEL;

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

      try {
        const client = new Anthropic({ apiKey });

        const anthropicMessages = body.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await client.messages.create({
          model,
          max_tokens: 4096,
          system: body.system,
          messages: anthropicMessages,
          stream: true,
        });

        for await (const event of response) {
          if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              clearInterval(pingTimer);
              const data = JSON.stringify({
                type: "text",
                content: event.delta.text,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: "" })}\n\n`,
          ),
        );
      } catch (error) {
        const content =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", content })}\n\n`,
          ),
        );
      } finally {
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
});
