import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "../../../../shared/types/events";
import {
  _resetLoopbackTriggersForTest,
  getRecordedLoopbackTriggers,
} from "../../analysis-tools";

// ── Mock the Agent SDK ──

const mockQueryClose = vi.fn();
const serverLogMock = vi.fn();
const serverWarnMock = vi.fn();
const serverErrorMock = vi.fn();

const mockQuery = vi.fn();
const mockCreateSdkMcpServer = vi.fn((opts: Record<string, unknown>) => ({
  type: "sdk",
  name: opts.name,
  tools: opts.tools,
  instance: {},
}));
const mockTool = vi.fn(
  (name: string, description: string, _schema: unknown, _handler: unknown) => ({
    name,
    description,
    handler: _handler,
  }),
);

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (a: unknown) => mockQuery(a),
  createSdkMcpServer: (a: unknown) =>
    mockCreateSdkMcpServer(a as Record<string, unknown>),
  tool: (a: string, b: string, c: unknown, d: unknown) => mockTool(a, b, c, d),
}));

vi.mock("../../../utils/resolve-claude-agent-env", () => ({
  buildClaudeAgentEnv: () => ({ PATH: "/usr/bin" }),
  getClaudeAgentDebugFilePath: () => "/tmp/debug.log",
}));

vi.mock("../../../utils/resolve-claude-cli", () => ({
  resolveClaudeCli: () => "/usr/local/bin/claude",
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverLog: (...args: unknown[]) => serverLogMock(...args),
  serverWarn: (...args: unknown[]) => serverWarnMock(...args),
  serverError: (...args: unknown[]) => serverErrorMock(...args),
}));

vi.mock("../../../mcp/product-tools", () => ({
  handleStartAnalysis: vi.fn(() => '{"runId":"r1"}'),
  handleGetAnalysisStatus: vi.fn(() => '{"status":"running"}'),
  handleCreateEntity: vi.fn(() => '{"id":"e1"}'),
  handleUpdateEntity: vi.fn(() => '{"id":"e1"}'),
  handleDeleteEntity: vi.fn(() => '{"deleted":true}'),
  handleCreateRelationship: vi.fn(() => '{"id":"r1"}'),
  handleDeleteRelationship: vi.fn(() => '{"deleted":true}'),
  handleRerunPhases: vi.fn(() => '{"runId":"reval-1"}'),
  handleAbortAnalysis: vi.fn(() => '{"aborted":true}'),
}));

// ── Tests ──

describe("claude-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLoopbackTriggersForTest();
  });

  describe("createChatMcpServer", () => {
    it("returns an MCP server config with type sdk", async () => {
      const { createChatMcpServer } = await import("../claude-adapter");
      const server = await createChatMcpServer();
      expect(server).toEqual(
        expect.objectContaining({
          type: "sdk",
          name: "game-theory-chat",
        }),
      );
      expect(mockCreateSdkMcpServer).toHaveBeenCalledOnce();
    });

    it("registers all chat-mode tools", async () => {
      const { createChatMcpServer, CHAT_MODE_TOOL_NAMES } =
        await import("../claude-adapter");
      await createChatMcpServer();
      // Each tool() call was made once
      expect(mockTool).toHaveBeenCalledTimes(CHAT_MODE_TOOL_NAMES.length);
      const registeredNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      for (const name of CHAT_MODE_TOOL_NAMES) {
        expect(registeredNames).toContain(name);
      }
    });
  });

  describe("createAnalysisMcpServer", () => {
    it("registers exactly the four analysis tools", async () => {
      const { createAnalysisMcpServer, ANALYSIS_TOOL_NAMES } =
        await import("../claude-adapter");
      const server = await createAnalysisMcpServer("run-test");

      expect(server).toEqual(
        expect.objectContaining({
          type: "sdk",
          name: "game-theory-analysis",
        }),
      );
      expect(mockTool).toHaveBeenCalledTimes(4);

      const registeredNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(registeredNames).toEqual(ANALYSIS_TOOL_NAMES);
    });

    it("records request_loopback triggers for the active run", async () => {
      const { createAnalysisMcpServer } = await import("../claude-adapter");
      const server = (await createAnalysisMcpServer(
        "run-loopback",
      )) as unknown as {
        tools: Array<{
          name: string;
          handler: (args: unknown) => Promise<unknown>;
        }>;
      };

      const requestLoopbackTool = server.tools.find(
        (tool) => tool.name === "request_loopback",
      );
      expect(requestLoopbackTool).toBeDefined();

      await requestLoopbackTool!.handler({
        trigger_type: "new_player",
        justification: "A new actor materially changed the game",
      });

      expect(getRecordedLoopbackTriggers("run-loopback")).toEqual([
        expect.objectContaining({
          trigger_type: "new_player",
          justification: "A new actor materially changed the game",
        }),
      ]);
    });
  });

  describe("streamChat", () => {
    it("uses correct chat profile settings", async () => {
      const { streamChat, CHAT_MODE_TOOL_NAMES } =
        await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: "ok",
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      // Consume the generator to trigger the query call
      const events: ChatEvent[] = [];
      for await (const ev of streamChat(
        "hello",
        "system",
        "claude-sonnet-4-6",
      )) {
        events.push(ev);
      }

      expect(mockQuery).toHaveBeenCalledOnce();
      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.prompt).toBe("hello");
      expect(callArgs.options.systemPrompt).toBe("system");
      expect(callArgs.options.model).toBe("claude-sonnet-4-6");
      expect(callArgs.options.maxTurns).toBe(99);
      expect(callArgs.options.tools).toEqual(["WebSearch"]);
      expect(callArgs.options.allowedTools).toEqual([
        ...CHAT_MODE_TOOL_NAMES.map(
          (toolName) => `mcp__game-theory-chat__${toolName}`,
        ),
        "WebSearch",
      ]);
      expect(callArgs.options.permissionMode).toBe("bypassPermissions");
      expect(callArgs.options.includePartialMessages).toBe(true);
      expect(callArgs.options.settingSources).toEqual([]);
      expect(callArgs.options.mcpServers).toBeDefined();
      expect(callArgs.options.mcpServers.chat).toBeDefined();
    });

    it("normalizes text_delta events to ChatEvent", async () => {
      const { streamChat } = await import("../claude-adapter");

      const messages = [
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello " },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "world" },
          },
        },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: "Hello world",
        },
      ];

      mockQuery.mockImplementation(() => {
        let idx = 0;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (idx < messages.length) {
                  return { done: false, value: messages[idx++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      expect(events).toEqual([
        { type: "text_delta", content: "Hello " },
        { type: "text_delta", content: "world" },
        { type: "turn_complete" },
      ]);
    });

    it("normalizes tool use to tool_call_start", async () => {
      const { streamChat } = await import("../claude-adapter");

      const messages = [
        {
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              name: "query_entities",
              input: { phase: "situational-grounding" },
            },
          },
        },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: "",
        },
      ];

      mockQuery.mockImplementation(() => {
        let idx = 0;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (idx < messages.length) {
                  return { done: false, value: messages[idx++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      expect(events[0]).toEqual({
        type: "tool_call_start",
        toolName: "query_entities",
        input: { phase: "situational-grounding" },
      });
    });

    it("emits turn_complete on result success", async () => {
      const { streamChat } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: "done",
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      expect(events).toContainEqual({ type: "turn_complete" });
    });

    it("emits error on result failure", async () => {
      const { streamChat } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "error_during_execution",
                      is_error: true,
                      errors: ["API rate limit"],
                      result: "",
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      expect(events).toContainEqual({
        type: "error",
        error: expect.objectContaining({
          message: "API rate limit",
          tag: "provider",
        }),
      });
    });

    it("emits error (not turn_complete) on 5-minute timeout", async () => {
      const { streamChat } = await import("../claude-adapter");

      // Simulate: timeout fires, q.close() ends the iterator, no result event
      mockQuery.mockImplementation(() => {
        let closeFn: (() => void) | null = null;
        return {
          close: () => {
            // When close is called (by timeout), resolve the pending next()
            closeFn?.();
          },
          [Symbol.asyncIterator]() {
            return {
              async next() {
                // Block until close() is called — simulates a hung query
                return new Promise<IteratorResult<unknown>>((resolve) => {
                  closeFn = () => resolve({ done: true, value: undefined });
                });
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      // Use a very short timeout to trigger it quickly in tests
      for await (const ev of streamChat("hello", "sys", "model", {
        timeoutMs: 10,
      })) {
        events.push(ev);
      }

      // Should get an error, NOT turn_complete
      expect(events).toContainEqual({
        type: "error",
        error: expect.objectContaining({
          message: "Chat turn timed out after 5 minutes",
          tag: "provider",
        }),
      });
      expect(events).not.toContainEqual({ type: "turn_complete" });
    });

    it("handles assistant fallback when no result event", async () => {
      const { streamChat } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let idx = 0;
        const msgs = [
          {
            type: "assistant",
            message: {
              content: [{ type: "text", text: "Fallback response" }],
            },
          },
        ];
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (idx < msgs.length) {
                  return { done: false, value: msgs[idx++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      // Should emit the fallback text plus turn_complete
      expect(events).toContainEqual({
        type: "text_delta",
        content: "Fallback response",
      });
      expect(events).toContainEqual({ type: "turn_complete" });
    });

    it("closes query and exits silently when signal is aborted", async () => {
      const { streamChat } = await import("../claude-adapter");

      // Simulate: abort fires while query is running, q.close() ends the iterator
      mockQuery.mockImplementation(() => {
        let closeFn: (() => void) | null = null;
        return {
          close: () => {
            closeFn?.();
          },
          [Symbol.asyncIterator]() {
            return {
              async next() {
                return new Promise<IteratorResult<unknown>>((resolve) => {
                  closeFn = () => resolve({ done: true, value: undefined });
                });
              },
            };
          },
        };
      });

      const abortController = new AbortController();
      const events: ChatEvent[] = [];

      // Abort after a short delay
      setTimeout(() => abortController.abort(), 10);

      for await (const ev of streamChat("hello", "sys", "model", {
        signal: abortController.signal,
      })) {
        events.push(ev);
      }

      // Should exit silently — no error, no turn_complete
      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "error" }),
      );
      expect(events).not.toContainEqual({ type: "turn_complete" });
    });

    it("emits tool_call_result from assistant content blocks", async () => {
      const { streamChat } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let idx = 0;
        const msgs = [
          {
            type: "assistant",
            message: {
              content: [
                {
                  type: "tool_result",
                  tool_name: "query_entities",
                  content: [{ text: "[]" }],
                },
              ],
            },
          },
          {
            type: "result",
            subtype: "success",
            is_error: false,
            result: "",
          },
        ];
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (idx < msgs.length) {
                  return { done: false, value: msgs[idx++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "sys", "model")) {
        events.push(ev);
      }

      expect(events).toContainEqual({
        type: "tool_call_result",
        toolName: "query_entities",
        output: [{ text: "[]" }],
      });
    });
  });

  describe("runAnalysisPhase", () => {
    it("uses correct analysis profile settings", async () => {
      const { runAnalysisPhase, ANALYSIS_TOOL_NAMES } =
        await import("../claude-adapter");

      const schema = {
        type: "object",
        properties: { entities: { type: "array" } },
      };

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: '{"entities":[]}',
                      structured_output: { entities: [] },
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase(
        "analyze this",
        "sys",
        "claude-sonnet-4-6",
        schema,
      );

      expect(mockQuery).toHaveBeenCalledOnce();
      const callArgs = mockQuery.mock.calls[0][0];
      expect(typeof callArgs.prompt[Symbol.asyncIterator]).toBe("function");
      expect(callArgs.options.maxTurns).toBe(12);
      expect(callArgs.options.includePartialMessages).toBe(true);
      expect(callArgs.options.outputFormat).toEqual({
        type: "json_schema",
        schema,
      });
      expect(callArgs.options.settingSources).toEqual([]);
      expect(callArgs.options.permissionMode).toBe("dontAsk");
      expect(callArgs.options.allowedTools).toEqual([
        ...ANALYSIS_TOOL_NAMES.map(
          (toolName) => `mcp__game-theory-analysis__${toolName}`,
        ),
        "WebSearch",
      ]);
      expect(callArgs.options.mcpServers).toEqual({
        analysis: expect.objectContaining({
          type: "sdk",
          name: "game-theory-analysis",
        }),
      });
    });

    it("passes configured maxTurns through the options object", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: '{"entities":[],"relationships":[]}',
                      structured_output: { entities: [], relationships: [] },
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase(
        "analyze",
        "sys",
        "model",
        { type: "object" },
        {
          maxTurns: 7,
        },
      );

      expect(mockQuery.mock.calls[0][0].options.maxTurns).toBe(7);
    });

    it("emits normalized activity callbacks for analysis tool use", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");
      const onActivity = vi.fn();

      mockQuery.mockImplementation(() => {
        let index = 0;
        const values = [
          {
            type: "stream_event",
            event: {
              type: "content_block_start",
              content_block: {
                type: "tool_use",
                name: "query_entities",
                input: { phase: "situational-grounding" },
              },
            },
          },
          {
            type: "result",
            subtype: "success",
            is_error: false,
            result: '{"entities":[],"relationships":[]}',
            structured_output: { entities: [], relationships: [] },
          },
        ];

        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (index < values.length) {
                  return { done: false, value: values[index++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase("analyze", "sys", "model", { type: "object" }, {
        onActivity,
      });

      expect(onActivity).toHaveBeenCalledWith({
        kind: "tool",
        message: "Using query_entities",
        toolName: "query_entities",
      });
    });

    it("emits WebSearch query activity when the query is available at tool start", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");
      const onActivity = vi.fn();

      mockQuery.mockImplementation(() => {
        let index = 0;
        const values = [
          {
            type: "stream_event",
            event: {
              type: "content_block_start",
              index: 0,
              content_block: {
                type: "tool_use",
                name: "WebSearch",
                input: { query: "US China tariff history 2025" },
              },
            },
          },
          {
            type: "result",
            subtype: "success",
            is_error: false,
            result: '{"entities":[],"relationships":[]}',
            structured_output: { entities: [], relationships: [] },
          },
        ];

        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (index < values.length) {
                  return { done: false, value: values[index++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase("analyze", "sys", "model", { type: "object" }, {
        onActivity,
      });

      expect(onActivity).toHaveBeenCalledWith({
        kind: "web-search",
        message: "Using WebSearch",
        query: "US China tariff history 2025",
      });
    });

    it("emits WebSearch query activity when the query arrives via streamed input deltas", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");
      const onActivity = vi.fn();

      mockQuery.mockImplementation(() => {
        let index = 0;
        const values = [
          {
            type: "stream_event",
            event: {
              type: "content_block_start",
              index: 0,
              content_block: {
                type: "tool_use",
                name: "WebSearch",
                input: {},
              },
            },
          },
          {
            type: "stream_event",
            event: {
              type: "content_block_delta",
              index: 0,
              delta: {
                type: "input_json_delta",
                partial_json: '{"query":"US China tariff history 2025"}',
              },
            },
          },
          {
            type: "result",
            subtype: "success",
            is_error: false,
            result: '{"entities":[],"relationships":[]}',
            structured_output: { entities: [], relationships: [] },
          },
        ];

        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (index < values.length) {
                  return { done: false, value: values[index++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase("analyze", "sys", "model", { type: "object" }, {
        onActivity,
      });

      expect(onActivity.mock.calls).toContainEqual([
        {
          kind: "web-search",
          message: "Using WebSearch",
        },
      ]);
      expect(onActivity.mock.calls).toContainEqual([
        {
          kind: "web-search",
          message: "Using WebSearch",
          query: "US China tariff history 2025",
        },
      ]);
    });

    it("falls back to generic WebSearch activity when no query can be parsed", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");
      const onActivity = vi.fn();

      mockQuery.mockImplementation(() => {
        let index = 0;
        const values = [
          {
            type: "stream_event",
            event: {
              type: "content_block_start",
              index: 0,
              content_block: {
                type: "tool_use",
                name: "WebSearch",
                input: {},
              },
            },
          },
          {
            type: "result",
            subtype: "success",
            is_error: false,
            result: '{"entities":[],"relationships":[]}',
            structured_output: { entities: [], relationships: [] },
          },
        ];

        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (index < values.length) {
                  return { done: false, value: values[index++] };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase("analyze", "sys", "model", { type: "object" }, {
        onActivity,
      });

      expect(onActivity).toHaveBeenCalledWith({
        kind: "web-search",
        message: "Using WebSearch",
      });
    });

    it("removes WebSearch from analysis allowedTools when webSearch is false", async () => {
      const { runAnalysisPhase, ANALYSIS_TOOL_NAMES } =
        await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: '{"entities":[],"relationships":[]}',
                      structured_output: { entities: [], relationships: [] },
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await runAnalysisPhase("analyze", "sys", "model", { type: "object" }, {
        webSearch: false,
      });

      expect(mockQuery.mock.calls[0][0].options.allowedTools).toEqual(
        ANALYSIS_TOOL_NAMES.map(
          (toolName) => `mcp__game-theory-analysis__${toolName}`,
        ),
      );
    });

    it("returns parsed structured output", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      const expected = { entities: [{ id: "e1" }], relationships: [] };

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: JSON.stringify(expected),
                      structured_output: expected,
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const result = await runAnalysisPhase("analyze", "sys", "model", {
        type: "object",
      });
      expect(result).toEqual(expected);
    });

    it("falls back to parsing result text when no structured_output", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      const expected = { entities: [] };

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      result: JSON.stringify(expected),
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      const result = await runAnalysisPhase("analyze", "sys", "model", {
        type: "object",
      });
      expect(result).toEqual(expected);
    });

    it("throws on error result", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      mockQuery.mockImplementation(() => {
        let done = false;
        return {
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "error_during_execution",
                      is_error: true,
                      errors: ["Model error"],
                      result: "",
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };
      });

      await expect(
        runAnalysisPhase("analyze", "sys", "model", { type: "object" }),
      ).rejects.toThrow("Model error");
    });

    it("falls back once for supported models when structured output ends without a result", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      mockQuery
        .mockImplementationOnce(() => ({
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                return { done: true, value: undefined };
              },
            };
          },
        }))
        .mockImplementationOnce(() => {
          let done = false;
          return {
            close: mockQueryClose,
            [Symbol.asyncIterator]() {
              return {
                async next() {
                  if (!done) {
                    done = true;
                    return {
                      done: false,
                      value: {
                        type: "result",
                        subtype: "success",
                        is_error: false,
                        result: '{"entities":[],"relationships":[]}',
                      },
                    };
                  }
                  return { done: true, value: undefined };
                },
              };
            },
          };
        });

      const result = await runAnalysisPhase(
        "analyze",
        "sys",
        "default",
        { type: "object" },
        { runId: "run-1" },
      );

      expect(result).toBe('{"entities":[],"relationships":[]}');
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[0][0].options.outputFormat).toEqual({
        type: "json_schema",
        schema: { type: "object" },
      });
      expect(mockQuery.mock.calls[1][0].options.outputFormat).toBeUndefined();
      expect(mockQuery.mock.calls[1][0].options.systemPrompt).toContain(
        "Structured output fallback mode",
      );
      expect(serverWarnMock).toHaveBeenCalledWith(
        "run-1",
        "claude-adapter",
        "analysis-fallback-start",
        expect.objectContaining({ model: "default" }),
      );
      expect(serverLogMock).toHaveBeenCalledWith(
        "run-1",
        "claude-adapter",
        "analysis-fallback-success",
        { model: "default" },
      );
    });

    it("does not fall back for unsupported models when structured output ends without a result", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      mockQuery.mockImplementationOnce(() => ({
        close: mockQueryClose,
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { done: true, value: undefined };
            },
          };
        },
      }));

      await expect(
        runAnalysisPhase("analyze", "sys", "haiku", { type: "object" }, {
          runId: "run-2",
        }),
      ).rejects.toThrow("Claude structured output ended without terminal result");

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(serverWarnMock).not.toHaveBeenCalledWith(
        "run-2",
        "claude-adapter",
        "analysis-fallback-start",
        expect.anything(),
      );
    });

    it("does not fall back on aborts", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      const controller = new AbortController();
      controller.abort();

      mockQuery.mockImplementationOnce(() => ({
        close: mockQueryClose,
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { done: true, value: undefined };
            },
          };
        },
      }));

      await expect(
        runAnalysisPhase("analyze", "sys", "default", { type: "object" }, {
          runId: "run-3",
          signal: controller.signal,
        }),
      ).rejects.toThrow("Aborted");

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("reports fallback failure clearly", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

      mockQuery
        .mockImplementationOnce(() => ({
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            return {
              async next() {
                return { done: true, value: undefined };
              },
            };
          },
        }))
        .mockImplementationOnce(() => ({
          close: mockQueryClose,
          [Symbol.asyncIterator]() {
            let done = false;
            return {
              async next() {
                if (!done) {
                  done = true;
                  return {
                    done: false,
                    value: {
                      type: "result",
                      subtype: "error_during_execution",
                      is_error: true,
                      errors: ["Fallback failed"],
                      result: "",
                    },
                  };
                }
                return { done: true, value: undefined };
              },
            };
          },
        }));

      await expect(
        runAnalysisPhase("analyze", "sys", "sonnet", { type: "object" }, {
          runId: "run-4",
        }),
      ).rejects.toThrow(
        "Claude structured-output attempt failed (Claude structured output ended without terminal result); JSON fallback failed: Fallback failed",
      );

      expect(serverErrorMock).toHaveBeenCalledWith(
        "run-4",
        "claude-adapter",
        "analysis-fallback-failed",
        expect.objectContaining({
          model: "sonnet",
          fallbackError: "Fallback failed",
        }),
      );
    });
  });
});
