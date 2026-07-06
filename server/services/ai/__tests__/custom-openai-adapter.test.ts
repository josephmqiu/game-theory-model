import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── OpenAI SDK mock ──
const { createMock, ctorSpy, handleToolCallMock, MockAPIError } = vi.hoisted(
  () => {
    class MockAPIError extends Error {
      status?: number;
      constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "APIError";
      }
    }
    return {
      createMock: vi.fn(),
      ctorSpy: vi.fn(),
      handleToolCallMock: vi.fn(),
      MockAPIError,
    };
  },
);

vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: createMock } };
    constructor(opts: unknown) {
      ctorSpy(opts);
    }
  }
  return { default: OpenAI, OpenAI, APIError: MockAPIError };
});

// ── product-tools mock (control handleToolCall; keep real tool definitions) ──
vi.mock("../../../mcp/product-tools", async (importActual) => {
  const actual =
    await importActual<typeof import("../../../mcp/product-tools")>();
  return { ...actual, handleToolCall: handleToolCallMock };
});

import {
  streamChat,
  runAnalysisPhase,
  type CustomChatInput,
} from "../custom-openai-adapter";
import { setSearchConfig } from "../../search/config-cache";
import type { ChatEvent } from "../../../../shared/types/events";

// ── helpers ──

interface StreamChunk {
  choices: Array<{
    delta?: { content?: string; tool_calls?: unknown[] };
    finish_reason?: string | null;
  }>;
}

function streamOf(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

function textChunk(content: string, finish?: string): StreamChunk {
  return {
    choices: [{ delta: { content }, finish_reason: finish ?? null }],
  };
}

function toolCallChunk(
  index: number,
  id: string,
  name: string,
  args: string,
  finish?: string,
): StreamChunk {
  return {
    choices: [
      {
        delta: {
          tool_calls: [{ index, id, function: { name, arguments: args } }],
        },
        finish_reason: finish ?? null,
      },
    ],
  };
}

async function collect(gen: AsyncGenerator<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

const BASE_INPUT: CustomChatInput = {
  system: "You are a helper.",
  messages: [{ role: "user", content: "hello" }],
  model: "test-model",
  baseURL: "https://api.example.com/v1",
  apiKey: "test-key",
  hasNativeWebSearch: false,
};

function lastParams(callIndex: number): Record<string, unknown> {
  return createMock.mock.calls[callIndex][0] as Record<string, unknown>;
}

beforeEach(() => {
  createMock.mockReset();
  ctorSpy.mockReset();
  handleToolCallMock.mockReset();
  setSearchConfig({ provider: null, apiKey: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("custom-openai-adapter streamChat", () => {
  it("streams a text-only turn and completes", async () => {
    createMock.mockResolvedValueOnce(
      streamOf([textChunk("Hello"), textChunk(" world", "stop")]),
    );

    const events = await collect(streamChat(BASE_INPUT));

    expect(events).toEqual([
      { type: "text_delta", content: "Hello" },
      { type: "text_delta", content: " world" },
      { type: "turn_complete" },
    ]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("runs a tool call: parses args, feeds tool result into a second round", async () => {
    createMock
      .mockResolvedValueOnce(
        streamOf([
          toolCallChunk(0, "call_1", "query_entities", '{"phase":"x"}'),
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      )
      .mockResolvedValueOnce(streamOf([textChunk("done", "stop")]));
    handleToolCallMock.mockResolvedValueOnce({ text: "[]", isError: false });

    const events = await collect(streamChat(BASE_INPUT));

    expect(handleToolCallMock).toHaveBeenCalledWith(
      "query_entities",
      { phase: "x" },
      expect.objectContaining({
        customCredentials: expect.objectContaining({
          baseURL: "https://api.example.com/v1",
        }),
      }),
    );
    expect(events).toContainEqual({
      type: "tool_call_start",
      toolName: "query_entities",
      input: { phase: "x" },
    });
    expect(events).toContainEqual({
      type: "tool_call_result",
      toolName: "query_entities",
      output: "[]",
    });
    expect(events.at(-1)).toEqual({ type: "turn_complete" });

    // Second request carries the assistant tool_calls message + tool result.
    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = lastParams(1).messages as Array<
      Record<string, unknown>
    >;
    expect(
      secondMessages.some(
        (m) => m.role === "assistant" && Array.isArray(m.tool_calls),
      ),
    ).toBe(true);
    expect(
      secondMessages.some(
        (m) => m.role === "tool" && m.tool_call_id === "call_1",
      ),
    ).toBe(true);
  });

  it("emits tool_call_error and continues the loop on malformed tool args", async () => {
    createMock
      .mockResolvedValueOnce(
        streamOf([
          toolCallChunk(0, "call_bad", "query_entities", "{not json"),
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      )
      .mockResolvedValueOnce(streamOf([textChunk("recovered", "stop")]));

    const events = await collect(streamChat(BASE_INPUT));

    expect(handleToolCallMock).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      type: "tool_call_error",
      toolName: "query_entities",
      error: "Tool arguments were not valid JSON.",
    });
    // Loop continued to a second round.
    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = lastParams(1).messages as Array<
      Record<string, unknown>
    >;
    expect(
      secondMessages.some(
        (m) => m.role === "tool" && m.tool_call_id === "call_bad",
      ),
    ).toBe(true);
  });

  it("yields an error event with status (not the key) on a 401", async () => {
    createMock.mockRejectedValueOnce(
      new MockAPIError(401, "Unauthorized: invalid token"),
    );

    const events = await collect(
      streamChat({ ...BASE_INPUT, apiKey: "super-secret-key" }),
    );

    expect(events).toHaveLength(1);
    const err = events[0] as { type: string; message: string };
    expect(err.type).toBe("error");
    expect(err.message).toContain("401");
    expect(err.message).not.toContain("super-secret-key");
  });

  it("caps the tool loop at MAX_TOOL_ROUNDS", async () => {
    createMock.mockImplementation(() =>
      Promise.resolve(
        streamOf([
          toolCallChunk(0, "c", "query_entities", "{}"),
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      ),
    );
    handleToolCallMock.mockResolvedValue({ text: "[]", isError: false });

    const events = await collect(streamChat(BASE_INPUT));

    expect(createMock).toHaveBeenCalledTimes(8);
    expect(handleToolCallMock).toHaveBeenCalledTimes(8);
    expect(events.at(-1)).toEqual({ type: "turn_complete" });
    expect(
      events.some(
        (e) =>
          e.type === "text_delta" &&
          e.content.includes("maximum number of tool-use rounds"),
      ),
    ).toBe(true);
  });

  it("stops immediately when the abort signal is already set", async () => {
    createMock.mockResolvedValueOnce(
      streamOf([textChunk("should not surface", "stop")]),
    );
    const controller = new AbortController();
    controller.abort();

    const events = await collect(
      streamChat(BASE_INPUT, { signal: controller.signal }),
    );

    expect(events).toEqual([]);
  });

  it("constructs the client with a placeholder key when apiKey is empty", async () => {
    createMock.mockResolvedValueOnce(streamOf([textChunk("hi", "stop")]));

    await collect(streamChat({ ...BASE_INPUT, apiKey: "" }));

    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-no-key", maxRetries: 0 }),
    );
  });

  it("excludes web_search when the endpoint has native web search", async () => {
    setSearchConfig({ provider: "tavily", apiKey: "k" });
    createMock.mockResolvedValueOnce(streamOf([textChunk("hi", "stop")]));

    await collect(streamChat({ ...BASE_INPUT, hasNativeWebSearch: true }));

    const tools = (lastParams(0).tools ?? []) as Array<{
      function: { name: string };
    }>;
    expect(tools.some((t) => t.function.name === "web_search")).toBe(false);
  });

  it("includes web_search when configured and no native search", async () => {
    setSearchConfig({ provider: "tavily", apiKey: "k" });
    createMock.mockResolvedValueOnce(streamOf([textChunk("hi", "stop")]));

    await collect(streamChat({ ...BASE_INPUT, hasNativeWebSearch: false }));

    const tools = (lastParams(0).tools ?? []) as Array<{
      function: { name: string };
    }>;
    expect(tools.some((t) => t.function.name === "web_search")).toBe(true);
  });

  it("truncates an oversized tool result before appending it to history", async () => {
    const huge = "y".repeat(50_000);
    createMock
      .mockResolvedValueOnce(
        streamOf([
          toolCallChunk(0, "call_big", "query_entities", "{}"),
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      )
      .mockResolvedValueOnce(streamOf([textChunk("done", "stop")]));
    handleToolCallMock.mockResolvedValueOnce({ text: huge, isError: false });

    await collect(streamChat(BASE_INPUT));

    const secondMessages = lastParams(1).messages as Array<{
      role: string;
      content: string;
      tool_call_id?: string;
    }>;
    const toolMsg = secondMessages.find(
      (m) => m.role === "tool" && m.tool_call_id === "call_big",
    )!;
    expect(toolMsg.content.length).toBeLessThan(50_000);
    expect(toolMsg.content).toContain("[truncated");
  });

  it("mechanically trims mid-turn when accumulated tool results exceed budget", async () => {
    const big = "z".repeat(29_000);
    let round = 0;
    createMock.mockImplementation(() => {
      round++;
      if (round <= 6) {
        return Promise.resolve(
          streamOf([
            toolCallChunk(0, `c${round}`, "query_entities", "{}"),
            { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
          ]),
        );
      }
      return Promise.resolve(streamOf([textChunk("final", "stop")]));
    });
    handleToolCallMock.mockResolvedValue({ text: big, isError: false });

    await collect(streamChat(BASE_INPUT));

    // Without mid-turn trimming, six 29k results would push a request well past
    // the 120k budget; the trim keeps every request within it.
    const lengths = createMock.mock.calls.map(([params]) => {
      const msgs = (params as { messages: Array<{ content?: unknown }> })
        .messages;
      return msgs.reduce(
        (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
        0,
      );
    });
    expect(Math.max(...lengths)).toBeLessThanOrEqual(120_000);
  });

  it("retries once without tools when the endpoint rejects tool definitions", async () => {
    createMock
      .mockRejectedValueOnce(
        new MockAPIError(400, "tools are not supported by this model"),
      )
      .mockResolvedValueOnce(streamOf([textChunk("plain reply", "stop")]));

    const events = await collect(streamChat(BASE_INPUT));

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(lastParams(0).tools).toBeDefined();
    expect(lastParams(1).tools).toBeUndefined();
    expect(
      events.some(
        (e) =>
          e.type === "text_delta" &&
          e.content.includes("rejected tool definitions"),
      ),
    ).toBe(true);
    expect(events.at(-1)).toEqual({ type: "turn_complete" });
  });

  it("redacts full credential values from endpoint errors", async () => {
    createMock.mockRejectedValueOnce(
      new MockAPIError(
        401,
        "upstream rejected Authorization: Bearer bearer-token-value and api_key=api-token-value and ANTHROPIC_API_KEY=anthropic-token-value",
      ),
    );

    const events = await collect(streamChat(BASE_INPUT));
    const errorEvent = events.find(
      (e): e is Extract<ChatEvent, { type: "error" }> => e.type === "error",
    );

    expect(errorEvent?.message).toContain("[redacted]");
    expect(errorEvent?.message).not.toContain("bearer-token-value");
    expect(errorEvent?.message).not.toContain("api-token-value");
    expect(errorEvent?.message).not.toContain("anthropic-token-value");
  });

  it("stops mid-stream when the signal aborts during streaming", async () => {
    const controller = new AbortController();
    createMock.mockResolvedValueOnce({
      async *[Symbol.asyncIterator]() {
        yield textChunk("first");
        // Abort between chunks: the next loop iteration must bail before
        // forwarding anything further, and must NOT emit turn_complete.
        controller.abort();
        yield textChunk(" second", "stop");
      },
    });

    const events = await collect(
      streamChat(BASE_INPUT, { signal: controller.signal }),
    );

    expect(events).toEqual([{ type: "text_delta", content: "first" }]);
  });

  it("excludes web_search when no search provider is configured", async () => {
    // beforeEach clears the search config, so isSearchConfigured() is false.
    createMock.mockResolvedValueOnce(streamOf([textChunk("hi", "stop")]));

    await collect(streamChat({ ...BASE_INPUT, hasNativeWebSearch: false }));

    const tools = (lastParams(0).tools ?? []) as Array<{
      function: { name: string };
    }>;
    expect(tools.some((t) => t.function.name === "web_search")).toBe(false);
    // Other product tools are still offered.
    expect(tools.length).toBeGreaterThan(0);
  });

  it("treats a non-tool finish_reason (length) as a completed turn", async () => {
    createMock.mockResolvedValueOnce(
      streamOf([textChunk("partial answer", "length")]),
    );

    const events = await collect(streamChat(BASE_INPUT));

    expect(events).toEqual([
      { type: "text_delta", content: "partial answer" },
      { type: "turn_complete" },
    ]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a tool-handler error as tool_call_error and feeds it back", async () => {
    createMock
      .mockResolvedValueOnce(
        streamOf([
          toolCallChunk(0, "call_e", "query_entities", "{}"),
          { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        ]),
      )
      .mockResolvedValueOnce(streamOf([textChunk("ok", "stop")]));
    // handleToolCall returns a structured error (isError) rather than throwing.
    handleToolCallMock.mockResolvedValueOnce({
      text: "Error: entity not found",
      isError: true,
    });

    const events = await collect(streamChat(BASE_INPUT));

    expect(events).toContainEqual({
      type: "tool_call_error",
      toolName: "query_entities",
      error: "Error: entity not found",
    });
    // The handler's error text is still appended as the tool result so the
    // model can recover on the next round.
    const secondMessages = lastParams(1).messages as Array<
      Record<string, unknown>
    >;
    expect(
      secondMessages.some(
        (m) =>
          m.role === "tool" &&
          m.tool_call_id === "call_e" &&
          m.content === "Error: entity not found",
      ),
    ).toBe(true);
    expect(events.at(-1)).toEqual({ type: "turn_complete" });
  });
});

describe("custom-openai-adapter history compaction", () => {
  const bigInput: CustomChatInput = {
    ...BASE_INPUT,
    messages: [
      { role: "user", content: "x".repeat(130_000) },
      { role: "assistant", content: "ok" },
      { role: "user", content: "recent question" },
    ],
  };

  it("summarizes evicted turns when over budget", async () => {
    createMock
      // summarize call (non-streaming)
      .mockResolvedValueOnce({
        choices: [
          { message: { content: "SUMMARY TEXT" }, finish_reason: "stop" },
        ],
      })
      // main streaming call
      .mockResolvedValueOnce(streamOf([textChunk("answer", "stop")]));

    await collect(streamChat(bigInput));

    expect(createMock).toHaveBeenCalledTimes(2);
    const mainMessages = lastParams(1).messages as Array<{
      role: string;
      content: string;
    }>;
    expect(
      mainMessages.some(
        (m) =>
          m.role === "user" && m.content.includes("[Conversation summary]"),
      ),
    ).toBe(true);
    expect(mainMessages.some((m) => m.content.includes("SUMMARY TEXT"))).toBe(
      true,
    );
  });

  it("mechanically trims when the summarize call fails", async () => {
    createMock
      .mockRejectedValueOnce(new MockAPIError(500, "summarize failed"))
      .mockResolvedValueOnce(streamOf([textChunk("answer", "stop")]));

    await collect(streamChat(bigInput));

    const mainMessages = lastParams(1).messages as Array<{
      role: string;
      content: string;
    }>;
    expect(
      mainMessages.some((m) =>
        m.content.includes("[Earlier conversation trimmed]"),
      ),
    ).toBe(true);
  });
});

describe("custom-openai-adapter runAnalysisPhase", () => {
  const schema = { type: "object", properties: {} };
  const analysisOpts = {
    baseURL: "https://api.example.com/v1",
    apiKey: "k",
    hasNativeWebSearch: false,
  };

  it("uses json_schema response_format on the first attempt", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: { content: '{"entities":[],"relationships":[]}' },
          finish_reason: "stop",
        },
      ],
    });

    const result = await runAnalysisPhase(
      "prompt",
      "system",
      "test-model",
      schema,
      analysisOpts,
    );

    expect(result).toEqual({ entities: [], relationships: [] });
    const params = lastParams(0);
    expect(params.response_format).toMatchObject({ type: "json_schema" });
  });

  it("falls back to prompt-embedded schema on a response_format 400", async () => {
    createMock
      .mockRejectedValueOnce(
        new MockAPIError(400, "response_format json_schema is not supported"),
      )
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '```json\n{"entities":[],"relationships":[]}\n```',
            },
            finish_reason: "stop",
          },
        ],
      });

    const result = await runAnalysisPhase(
      "prompt",
      "system",
      "test-model",
      schema,
      analysisOpts,
    );

    expect(result).toEqual({ entities: [], relationships: [] });
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(lastParams(1).response_format).toBeUndefined();
    const fallbackMessages = lastParams(1).messages as Array<{
      content: string;
    }>;
    expect(
      fallbackMessages.some((m) => m.content.includes("ONLY valid JSON")),
    ).toBe(true);
  });

  it("retries analysis without tools when the endpoint rejects tool definitions", async () => {
    createMock
      .mockRejectedValueOnce(
        new MockAPIError(400, "tools are not supported by this model"),
      )
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: '{"entities":[],"relationships":[]}' },
            finish_reason: "stop",
          },
        ],
      });

    const result = await runAnalysisPhase(
      "prompt",
      "system",
      "test-model",
      schema,
      analysisOpts,
    );

    expect(result).toEqual({ entities: [], relationships: [] });
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(lastParams(0).tools).toBeDefined();
    expect(lastParams(1).tools).toBeUndefined();
    expect(lastParams(1).response_format).toMatchObject({
      type: "json_schema",
    });
  });

  it("responds to non-function tool calls so no tool_call_id is orphaned", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "c_custom",
                  type: "custom",
                  custom: { name: "x", input: "y" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: '{"entities":[],"relationships":[]}' },
            finish_reason: "stop",
          },
        ],
      });

    const result = await runAnalysisPhase(
      "prompt",
      "system",
      "test-model",
      schema,
      analysisOpts,
    );

    expect(result).toEqual({ entities: [], relationships: [] });
    expect(handleToolCallMock).not.toHaveBeenCalled();
    // The non-function tool_call id still gets a tool response in round 2.
    const secondMessages = lastParams(1).messages as Array<{
      role: string;
      tool_call_id?: string;
    }>;
    expect(
      secondMessages.some(
        (m) => m.role === "tool" && m.tool_call_id === "c_custom",
      ),
    ).toBe(true);
  });

  it("throws a clear error when the final JSON is unparseable", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: "not json at all" }, finish_reason: "stop" },
      ],
    });

    await expect(
      runAnalysisPhase("prompt", "system", "test-model", schema, analysisOpts),
    ).rejects.toThrow(/unparseable JSON/);
  });

  it("runs the analysis tool loop: executes a tool, then returns final JSON", async () => {
    createMock
      // Round 1: model requests a tool.
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_a",
                  type: "function",
                  function: {
                    name: "query_entities",
                    arguments: '{"phase":"x"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
      // Round 2: model returns the structured answer.
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: '{"entities":[],"relationships":[]}' },
            finish_reason: "stop",
          },
        ],
      });
    handleToolCallMock.mockResolvedValueOnce({ text: "[]", isError: false });

    const result = await runAnalysisPhase(
      "prompt",
      "system",
      "test-model",
      schema,
      analysisOpts,
    );

    expect(result).toEqual({ entities: [], relationships: [] });
    // The tool ran with the BYOK creds threaded through the context.
    expect(handleToolCallMock).toHaveBeenCalledWith(
      "query_entities",
      { phase: "x" },
      expect.objectContaining({
        customCredentials: expect.objectContaining({
          baseURL: "https://api.example.com/v1",
        }),
      }),
    );
    // Round 2 carries the assistant tool_calls message + the tool result
    // answering call_a — no orphaned tool_call_id.
    expect(createMock).toHaveBeenCalledTimes(2);
    const secondMessages = lastParams(1).messages as Array<
      Record<string, unknown>
    >;
    expect(
      secondMessages.some(
        (m) => m.role === "assistant" && Array.isArray(m.tool_calls),
      ),
    ).toBe(true);
    expect(
      secondMessages.some(
        (m) => m.role === "tool" && m.tool_call_id === "call_a",
      ),
    ).toBe(true);
  });
});
