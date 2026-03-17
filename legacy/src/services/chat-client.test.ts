import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIStreamChunk } from "shared/game-theory/types/ai-stream";
import { streamChat } from "./chat-client";

function mockSSEResponse(events: AIStreamChunk[]): Response {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `data: ${JSON.stringify(e)}\n\n`);
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function collectChunks(
  gen: AsyncGenerator<AIStreamChunk>,
): Promise<AIStreamChunk[]> {
  const collected: AIStreamChunk[] = [];
  for await (const chunk of gen) {
    collected.push(chunk);
  }
  return collected;
}

const defaultParams = {
  system: "You are a game theory copilot.",
  messages: [{ role: "user" as const, content: "Hello" }],
  provider: "anthropic",
};

describe("streamChat", () => {
  it("POSTs to /api/ai/chat with system field", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockSSEResponse([{ type: "done", content: "" }]),
    );

    await collectChunks(streamChat(defaultParams));

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"system"'),
      }),
    );

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.system).toBe("You are a game theory copilot.");
    expect(body.provider).toBe("anthropic");
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("parses text events from SSE stream", async () => {
    const events: AIStreamChunk[] = [
      { type: "text", content: "Hello" },
      { type: "text", content: " world" },
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectChunks(streamChat(defaultParams));

    expect(collected).toHaveLength(3);
    expect(collected[0]).toEqual({ type: "text", content: "Hello" });
    expect(collected[1]).toEqual({ type: "text", content: " world" });
    expect(collected[2]).toEqual({ type: "done", content: "" });
  });

  it("parses thinking events from SSE stream", async () => {
    const events: AIStreamChunk[] = [
      { type: "thinking", content: "Reasoning..." },
      { type: "text", content: "Answer" },
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectChunks(streamChat(defaultParams));

    expect(collected).toHaveLength(3);
    expect(collected[0]).toEqual({ type: "thinking", content: "Reasoning..." });
  });

  it("skips ping events", async () => {
    const events: AIStreamChunk[] = [
      { type: "ping", content: "keepalive" },
      { type: "text", content: "Hello" },
      { type: "ping", content: "keepalive" },
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectChunks(streamChat(defaultParams));

    expect(collected).toHaveLength(2);
    expect(collected.every((e) => e.type !== "ping")).toBe(true);
    expect(collected[0]).toEqual({ type: "text", content: "Hello" });
    expect(collected[1]).toEqual({ type: "done", content: "" });
  });

  it("stops yielding after done event", async () => {
    const events: AIStreamChunk[] = [
      { type: "text", content: "Before done" },
      { type: "done", content: "finished" },
      { type: "text", content: "After done — should not appear" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectChunks(streamChat(defaultParams));

    expect(collected).toHaveLength(2);
    expect(collected[1]).toEqual({ type: "done", content: "finished" });
    expect(
      collected.some(
        (e) => e.type === "text" && e.content.includes("After done"),
      ),
    ).toBe(false);
  });

  it("throws a friendly message on 401", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(collectChunks(streamChat(defaultParams))).rejects.toThrow(
      "API key not configured",
    );
  });

  it("throws a friendly message on 429", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));

    await expect(collectChunks(streamChat(defaultParams))).rejects.toThrow(
      "Rate limited",
    );
  });

  it("throws a friendly message on 500+", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 503, statusText: "Service Unavailable" }),
    );

    await expect(collectChunks(streamChat(defaultParams))).rejects.toThrow(
      "Server error (503)",
    );
  });

  it("throws on other non-200 responses", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Bad request body", { status: 400 }),
    );

    await expect(collectChunks(streamChat(defaultParams))).rejects.toThrow(
      "Request failed (400)",
    );
  });

  it("handles SSE data split across chunks", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"te'));
        controller.enqueue(encoder.encode('xt","content":"hi"}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"type":"done","content":""}\n\n'),
        );
        controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(stream, { status: 200 }));

    const collected = await collectChunks(streamChat(defaultParams));

    expect(collected).toHaveLength(2);
    expect(collected[0]).toEqual({ type: "text", content: "hi" });
    expect(collected[1]).toEqual({ type: "done", content: "" });
  });

  it("handles abort signal without throwing", async () => {
    const controller = new AbortController();

    const abortError = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValue(abortError);

    controller.abort();

    await expect(
      collectChunks(streamChat(defaultParams, controller.signal)),
    ).resolves.toEqual([]);
  });

  it("includes model in request body when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockSSEResponse([{ type: "done", content: "" }]),
    );

    await collectChunks(
      streamChat({ ...defaultParams, model: "claude-sonnet-4-6" }),
    );

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.model).toBe("claude-sonnet-4-6");
  });
});
