import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "@/services/ai/chat-events";

// ── Mock the Agent SDK ──

const mockQueryClose = vi.fn();

const mockQuery = vi.fn();
const mockCreateSdkMcpServer = vi.fn((_opts: unknown) => ({
  type: "sdk",
  name: "game-theory-product",
  instance: {},
}));
const mockTool = vi.fn(
  (name: string, description: string, _schema: unknown, _handler: unknown) => ({
    name,
    description,
  }),
);

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (a: unknown) => mockQuery(a),
  createSdkMcpServer: (a: unknown) => mockCreateSdkMcpServer(a),
  tool: (a: string, b: string, c: unknown, d: unknown) => mockTool(a, b, c, d),
}));

vi.mock("../../../utils/resolve-claude-agent-env", () => ({
  buildClaudeAgentEnv: () => ({ PATH: "/usr/bin" }),
  getClaudeAgentDebugFilePath: () => "/tmp/debug.log",
}));

vi.mock("../../../utils/resolve-claude-cli", () => ({
  resolveClaudeCli: () => "/usr/local/bin/claude",
}));

vi.mock("@/mcp/server", () => ({
  handleStartAnalysis: vi.fn(() => '{"runId":"r1"}'),
  handleGetAnalysisStatus: vi.fn(() => '{"status":"running"}'),
  handleGetAnalysisResult: vi.fn(() => '{"entities":[]}'),
  handleRevalidateEntities: vi.fn(() => '{"revalidated":0}'),
  handleGetEntities: vi.fn(() => "[]"),
  handleCreateEntity: vi.fn(() => '{"id":"e1"}'),
  handleUpdateEntity: vi.fn(() => '{"id":"e1"}'),
  handleGetRelationships: vi.fn(() => "[]"),
  handleCreateRelationship: vi.fn(() => '{"id":"r1"}'),
  handleUpdateRelationship: vi.fn(() => '{"id":"r1"}'),
  handleLayoutEntities: vi.fn(() => '{"error":"Not yet implemented"}'),
  handleFocusEntity: vi.fn(() => '{"error":"Not yet implemented"}'),
  handleGroupEntities: vi.fn(() => '{"error":"Not yet implemented"}'),
}));

// ── Tests ──

describe("claude-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProductMcpServer", () => {
    it("returns an MCP server config with type sdk", async () => {
      const { createProductMcpServer } = await import("../claude-adapter");
      const server = await createProductMcpServer();
      expect(server).toEqual(
        expect.objectContaining({
          type: "sdk",
          name: "game-theory-product",
        }),
      );
      expect(mockCreateSdkMcpServer).toHaveBeenCalledOnce();
    });

    it("registers all 13 product tools", async () => {
      const { createProductMcpServer, PRODUCT_TOOL_NAMES } =
        await import("../claude-adapter");
      await createProductMcpServer();
      // Each tool() call was made once
      expect(mockTool).toHaveBeenCalledTimes(13);
      // Verify each product tool name was registered
      const registeredNames = mockTool.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      for (const name of PRODUCT_TOOL_NAMES) {
        expect(registeredNames).toContain(name);
      }
    });
  });

  describe("streamChat", () => {
    it("uses correct chat profile settings", async () => {
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
      expect(callArgs.options.maxTurns).toBe(25);
      expect(callArgs.options.tools).toEqual(["WebSearch"]);
      expect(callArgs.options.permissionMode).toBe("bypassPermissions");
      expect(callArgs.options.includePartialMessages).toBe(true);
      expect(callArgs.options.settingSources).toEqual([]);
      expect(callArgs.options.mcpServers).toBeDefined();
      expect(callArgs.options.mcpServers.product).toBeDefined();
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
              name: "get_entities",
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
        toolName: "get_entities",
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
        message: "API rate limit",
        recoverable: false,
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
        message: "Chat turn timed out after 5 minutes",
        recoverable: false,
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
                  tool_name: "get_entities",
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
        toolName: "get_entities",
        output: [{ text: "[]" }],
      });
    });
  });

  describe("runAnalysisPhase", () => {
    it("uses correct analysis profile settings", async () => {
      const { runAnalysisPhase } = await import("../claude-adapter");

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
      expect(callArgs.options.maxTurns).toBe(1);
      expect(callArgs.options.includePartialMessages).toBe(false);
      expect(callArgs.options.outputFormat).toEqual({
        type: "json_schema",
        schema,
      });
      expect(callArgs.options.settingSources).toEqual([]);
      expect(callArgs.options.permissionMode).toBe("bypassPermissions");
      // No mcpServers for analysis
      expect(callArgs.options.mcpServers).toBeUndefined();
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
  });
});
