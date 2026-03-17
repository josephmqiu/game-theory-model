import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentEvent } from "shared/game-theory/types/agent";
import { streamAgentChat } from "./agent-client";

function mockSSEResponse(events: AgentEvent[]): Response {
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

async function collectEvents(
  gen: AsyncGenerator<AgentEvent>,
): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = [];
  for await (const event of gen) {
    collected.push(event);
  }
  return collected;
}

describe("streamAgentChat", () => {
  it("parses text events from SSE stream", async () => {
    const events: AgentEvent[] = [
      { type: "text", content: "Hello" },
      { type: "text", content: " world" },
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectEvents(
      streamAgentChat({ messages: [], provider: "anthropic" }),
    );

    expect(collected).toHaveLength(3);
    expect(collected[0]).toEqual({ type: "text", content: "Hello" });
    expect(collected[1]).toEqual({ type: "text", content: " world" });
    expect(collected[2]).toEqual({ type: "done", content: "" });
  });

  it("parses tool_call and tool_result events", async () => {
    const toolCall: AgentEvent = {
      type: "tool_call",
      id: "tc-1",
      name: "get_analysis_status",
      input: { verbose: true },
    };
    const toolResult: AgentEvent = {
      type: "tool_result",
      id: "tc-1",
      result: { has_analysis: true },
      duration_ms: 42,
    };
    const events: AgentEvent[] = [
      toolCall,
      toolResult,
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectEvents(
      streamAgentChat({ messages: [], provider: "anthropic" }),
    );

    expect(collected).toHaveLength(3);
    expect(collected[0]).toEqual(toolCall);
    expect(collected[1]).toEqual(toolResult);
  });

  it("skips ping events", async () => {
    const events: AgentEvent[] = [
      { type: "ping", content: "keepalive" },
      { type: "text", content: "Hello" },
      { type: "ping", content: "keepalive" },
      { type: "done", content: "" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectEvents(
      streamAgentChat({ messages: [], provider: "anthropic" }),
    );

    expect(collected).toHaveLength(2);
    expect(collected.every((e) => e.type !== "ping")).toBe(true);
    expect(collected[0]).toEqual({ type: "text", content: "Hello" });
    expect(collected[1]).toEqual({ type: "done", content: "" });
  });

  it("stops yielding after done event", async () => {
    const events: AgentEvent[] = [
      { type: "text", content: "Before done" },
      { type: "done", content: "finished" },
      { type: "text", content: "After done — should not appear" },
    ];
    vi.mocked(fetch).mockResolvedValue(mockSSEResponse(events));

    const collected = await collectEvents(
      streamAgentChat({ messages: [], provider: "anthropic" }),
    );

    expect(collected).toHaveLength(2);
    expect(collected[1]).toEqual({ type: "done", content: "finished" });
    expect(
      collected.some(
        (e) => e.type === "text" && e.content.includes("After done"),
      ),
    ).toBe(false);
  });

  it("throws on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(
      collectEvents(streamAgentChat({ messages: [], provider: "anthropic" })),
    ).rejects.toThrow("Agent request failed: 500");
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

    const collected = await collectEvents(
      streamAgentChat({ messages: [], provider: "anthropic" }),
    );

    expect(collected).toHaveLength(2);
    expect(collected[0]).toEqual({ type: "text", content: "hi" });
    expect(collected[1]).toEqual({ type: "done", content: "" });
  });

  it("handles abort signal without throwing", async () => {
    const controller = new AbortController();

    // Abort before fetch resolves
    const abortError = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValue(abortError);

    controller.abort();

    await expect(
      collectEvents(
        streamAgentChat(
          { messages: [], provider: "anthropic" },
          controller.signal,
        ),
      ),
    ).resolves.toEqual([]);
  });
});
