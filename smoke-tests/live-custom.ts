/**
 * live-custom.ts — on-demand smoke test for the BYOK "custom" OpenAI-compatible
 * provider. NEVER runs in CI; it talks to a real third-party endpoint you point
 * it at via env vars.
 *
 * What it proves, in three stages:
 *   Test A — the endpoint + key + model are valid, by POSTing a trivial prompt
 *            straight to `${CUSTOM_BASE_URL}/chat/completions` (no app involved).
 *   Test B — a chat turn survives the app's own path: POST /api/ai/chat with
 *            provider "custom" and stream the SSE response, asserting at least
 *            one `text_delta` and a terminal `done`, with no `error` event.
 *   Test C — best-effort tool call: same route, a prompt that should trigger the
 *            `query_entities` tool; asserts a `tool_call_start` arrives. Models
 *            vary, so a refusal only WARNs — transport/auth errors still fail.
 *
 * Contract notes / assumptions:
 *   - Tests B/C drive the built Nitro server over HTTP (via startBuiltServer),
 *     so this file has NO compile-time import of the custom adapter — the SKIP
 *     path needs no build.
 *   - The chat route's terminal SSE event is `done` (see server/api/ai/chat.ts);
 *     `turn_complete` is an adapter-internal event that is not forwarded.
 *   - The request body carries `custom: { baseURL, apiKey, hasNativeWebSearch }`
 *     alongside provider "custom" — the wire shape the custom adapter consumes.
 *     A 400 rejecting provider "custom" now signals a real regression (or a
 *     stale build that predates the custom adapter) and FAILS the run.
 *
 * Endpoint matrix we care about (run against at least one of each):
 *   - a tool-calling endpoint (OpenCode Go / OpenRouter) — exercises Test C
 *   - an endpoint WITHOUT json_schema structured-output support — Test B should
 *     still yield plain text via the adapter's fallback
 *
 * Example invocations:
 *   CUSTOM_BASE_URL=https://opencode.ai/zen/go/v1 CUSTOM_API_KEY=sk-... \
 *     CUSTOM_MODEL=... npx tsx smoke-tests/live-custom.ts
 *   # keyless local endpoint (Ollama-style):
 *   CUSTOM_BASE_URL=http://localhost:11434/v1 CUSTOM_MODEL=llama3.1 \
 *     npx tsx smoke-tests/live-custom.ts
 *
 * Tests B/C need a built server (`bun run test:smoke:prepare`, or any existing
 * .output build). The SKIP path exits before any build is required.
 */
import { assert, startBuiltServer } from "./_lib";
import { startMcpServer } from "../server/mcp/mcp-server";

const PROBE_TIMEOUT_MS = 45_000;

function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * POST to /api/ai/chat and yield each parsed SSE `data:` payload. Throws a plain
 * Error on any non-streaming response (transport/auth/validation failure,
 * including a 400 that rejects provider "custom").
 */
async function* streamChatSse(
  baseUrl: string,
  body: unknown,
  timeoutMs: number,
): AsyncGenerator<SseEvent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/event-stream")) {
      const text = await response.text();
      throw new Error(
        `chat route returned HTTP ${response.status} (${contentType}): ${truncate(text)}`,
      );
    }

    assert(response.body, "chat route returned no response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const json = dataLine.slice("data:".length).trim();
        if (!json) continue;
        try {
          yield JSON.parse(json) as SseEvent;
        } catch {
          // Ignore keepalive/comment frames that are not JSON payloads.
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Test A: direct sanity check against the raw OpenAI-compatible endpoint. */
async function testDirectEndpoint(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "user", content: "Reply with the word OK and nothing else." },
      ],
      stream: false,
      max_tokens: 16,
    }),
  });

  const text = await response.text();
  assert(
    response.ok,
    `Test A: endpoint returned HTTP ${response.status}: ${truncate(text)}`,
  );

  let json: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Test A: response was not JSON: ${truncate(text)}`);
  }
  const content = json.choices?.[0]?.message?.content;
  assert(
    typeof content === "string" && content.trim().length > 0,
    `Test A: no assistant text in response: ${truncate(text)}`,
  );
  console.log(
    `  Test A ok — direct endpoint replied: "${truncate(content.trim(), 40)}"`,
  );
}

function customChatBody(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
): unknown {
  return {
    system: "You are concise.",
    messages: [{ role: "user", content: prompt }],
    model,
    provider: "custom",
    // BYOK connection details — the wire shape the custom adapter consumes.
    custom: { baseURL: baseUrl, apiKey, hasNativeWebSearch: false },
  };
}

/** Test B: a chat turn through the app's SSE route yields text and completes. */
async function testAppChatPath(
  serverBaseUrl: string,
  customBaseUrl: string,
  apiKey: string,
  model: string,
): Promise<void> {
  let sawText = false;
  let sawDone = false;

  for await (const ev of streamChatSse(
    serverBaseUrl,
    customChatBody(
      customBaseUrl,
      apiKey,
      model,
      "Reply with the word OK and nothing else.",
    ),
    PROBE_TIMEOUT_MS,
  )) {
    if (ev.type === "error") {
      throw new Error(
        `Test B: chat stream emitted error: ${String(ev.message ?? "unknown")}`,
      );
    }
    if (
      ev.type === "text_delta" &&
      typeof ev.content === "string" &&
      ev.content.trim().length > 0
    ) {
      sawText = true;
    }
    if (ev.type === "done") {
      sawDone = true;
      break;
    }
  }

  assert(sawDone, "Test B: chat stream never emitted a terminal `done` event");
  assert(sawText, "Test B: chat stream completed without any text output");
  console.log("  Test B ok — app chat path streamed text and completed");
}

/** Test C (best-effort): a tool-provoking prompt should trigger a tool call. */
async function testToolCall(
  serverBaseUrl: string,
  customBaseUrl: string,
  apiKey: string,
  model: string,
): Promise<void> {
  let sawToolCall = false;
  let sawDone = false;

  for await (const ev of streamChatSse(
    serverBaseUrl,
    customChatBody(
      customBaseUrl,
      apiKey,
      model,
      "Use the query_entities tool and tell me how many entities exist.",
    ),
    PROBE_TIMEOUT_MS,
  )) {
    if (ev.type === "error") {
      throw new Error(
        `Test C: chat stream emitted error: ${String(ev.message ?? "unknown")}`,
      );
    }
    if (ev.type === "tool_call_start") {
      sawToolCall = true;
    }
    if (ev.type === "done") {
      sawDone = true;
      break;
    }
  }

  assert(sawDone, "Test C: chat stream never emitted a terminal `done` event");
  if (sawToolCall) {
    console.log("  Test C ok — model invoked a tool (tool_call_start seen)");
  } else {
    console.warn(
      "  Test C WARN — model completed without a tool call; tool support varies by endpoint/model",
    );
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.CUSTOM_BASE_URL?.trim();
  const model = process.env.CUSTOM_MODEL?.trim();
  // Key is optional: some endpoints (local Ollama, etc.) are keyless.
  const apiKey = process.env.CUSTOM_API_KEY ?? "";

  if (!baseUrl || !model) {
    console.log(
      "live-custom: skipped — set CUSTOM_BASE_URL/CUSTOM_MODEL (and usually CUSTOM_API_KEY)",
    );
    return;
  }

  // Test A first: prove the endpoint before spinning up the app.
  await testDirectEndpoint(baseUrl, apiKey, model);

  // Tests B/C: boot the app server (+ in-process MCP so tools are reachable).
  const mcpHandle = await startMcpServer();
  if (!mcpHandle.available) {
    throw new Error("Failed to start in-process MCP server for live-custom");
  }

  const server = await startBuiltServer({ mcpPort: mcpHandle.port });
  try {
    await testAppChatPath(server.baseUrl, baseUrl, apiKey, model);
    await testToolCall(server.baseUrl, baseUrl, apiKey, model);
    console.log(JSON.stringify({ ok: true, model }));
  } finally {
    await server.process.stop();
    await mcpHandle.close();
  }
}

await main();
