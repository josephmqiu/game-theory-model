import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ChatEvent } from "../../../../shared/types/events";
import { EventEmitter } from "node:events";

const mockInstallMcpServer = vi.fn();
const mockResolveMcpServerScript = vi.fn(() => "/mock/dist/mcp-server.cjs");

class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(() => true),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  exitCode: number | null = null;
  pid = 12345;

  kill = vi.fn(() => true);
}

let mockChild: MockChildProcess;
let stdinHandler:
  | ((method: string, id: number | undefined, params: unknown) => void)
  | null = null;

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    mockChild = new MockChildProcess();
    if (stdinHandler) {
      const handler = stdinHandler;
      mockChild.stdin.write.mockImplementation((...args: unknown[]) => {
        const data = args[0] as string;
        try {
          const parsed = JSON.parse(data.trim());
          queueMicrotask(() => handler(parsed.method, parsed.id, parsed.params));
        } catch {
          // ignore non-JSON writes
        }
        return true;
      });
    }
    return mockChild;
  }),
}));

vi.mock("../../../utils/codex-client", () => ({
  filterCodexEnv: vi.fn((env: Record<string, string | undefined>) => {
    const result: Record<string, string | undefined> = {};
    if (env.PATH) result.PATH = env.PATH;
    if (env.HOME) result.HOME = env.HOME;
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith("OPENAI_") || key.startsWith("CODEX_")) {
        result[key] = value;
      }
    }
    return result;
  }),
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

vi.mock("../codex-config", () => ({
  CODEX_MCP_SERVER_NAME: "game_theory_analyzer_mcp",
  installMcpServer: (...args: unknown[]) => mockInstallMcpServer(...args),
}));

vi.mock("../../../utils/mcp-server-manager", () => ({
  resolveMcpServerScript: () => mockResolveMcpServerScript(),
}));

function emitResponse(id: number, result: unknown) {
  const line = JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
  mockChild.stdout.emit("data", Buffer.from(line));
}

function emitNotification(method: string, params: Record<string, unknown>) {
  const line = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
  mockChild.stdout.emit("data", Buffer.from(line));
}

function emitErrorNotification(
  error: Record<string, unknown>,
  threadId = "thread-1",
  turnId = "turn-1",
  willRetry = false,
) {
  emitNotification("error", {
    error,
    threadId,
    turnId,
    willRetry,
  });
}

function emitThreadStartResponse(id: number, threadId = "thread-1") {
  emitResponse(id, { thread: { id: threadId } });
}

function emitTurnStartResponse(id: number, turnId = "turn-1") {
  emitResponse(id, {
    turn: {
      id: turnId,
      items: [],
      status: "inProgress",
    },
  });
}

function emitTurnCompleted(
  threadId = "thread-1",
  turnId = "turn-1",
  status = "completed",
  error?: {
    message: string;
    additionalDetails?: string;
    codexErrorInfo?: unknown;
  },
) {
  emitNotification("turn/completed", {
    threadId,
    turn: {
      id: turnId,
      items: [],
      status,
      ...(error ? { error } : {}),
    },
  });
}

function emitItemCompleted(
  item: Record<string, unknown>,
  threadId = "thread-1",
  turnId = "turn-1",
) {
  emitNotification("item/completed", {
    item,
    threadId,
    turnId,
  });
}

function respondToChatConfig(method: string, id: number | undefined): boolean {
  if (method === "config/mcpServer/reload" && id !== undefined) {
    emitResponse(id, { ok: true });
    return true;
  }

  if (method === "mcpServerStatus/list" && id !== undefined) {
    emitResponse(id, {
      data: [
        {
          name: "game_theory_analyzer_mcp",
          tools: {
            get_entity: {},
            query_entities: {},
            query_relationships: {},
            request_loopback: {},
            start_analysis: {},
            get_analysis_status: {},
            create_entity: {},
            update_entity: {},
            delete_entity: {},
            create_relationship: {},
            delete_relationship: {},
            rerun_phases: {},
            abort_analysis: {},
          },
        },
      ],
    });
    return true;
  }

  return false;
}

function setAutoResponder(
  handler: (method: string, id: number | undefined, params: unknown) => void,
) {
  stdinHandler = handler;
}

describe("codex-adapter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    stdinHandler = null;
    const mod = await import("../codex-adapter");
    mod._resetConnection();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startAppServer", () => {
    it("spawns subprocess with filtered env and sends initialize", async () => {
      const { spawn } = await import("node:child_process");
      const { startAppServer, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
      });

      const conn = await startAppServer("test-run");

      expect(spawn).toHaveBeenCalledWith(
        "codex",
        ["app-server"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const initReq = JSON.parse(calls[0][0].trim());
      expect(initReq.method).toBe("initialize");

      const initNotif = JSON.parse(calls[1][0].trim());
      expect(initNotif.method).toBe("initialized");
      expect(conn.process).toBe(mockChild);
    });
  });

  describe("streamChat", () => {
    it("yields streamed text deltas and turn_complete", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/agentMessage/delta", {
              delta: "Hello ",
              threadId: "thread-1",
              turnId: "turn-1",
            });
            emitNotification("item/agentMessage/delta", {
              delta: "world",
              threadId: "thread-1",
              turnId: "turn-1",
            });
            emitTurnCompleted();
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const event of streamChat("hello", "system", "gpt-4o")) {
        events.push(event);
      }

      expect(events).toContainEqual({ type: "text_delta", content: "Hello " });
      expect(events).toContainEqual({ type: "text_delta", content: "world" });
      expect(events).toContainEqual({ type: "turn_complete" });
    });

    it("uses developerInstructions on thread/start and input items on turn/start", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id, "thread-chat-456");
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-chat-1");
          queueMicrotask(() => emitTurnCompleted("thread-chat-456", "turn-chat-1"));
        }
      });

      for await (const _event of streamChat("hello", "system", "gpt-4o")) {
        // drain
      }

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const threadStartReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes('"thread/start"'))!.trim(),
      );
      expect(threadStartReq.params.developerInstructions).toBe("system");

      const turnStartReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes('"turn/start"'))!.trim(),
      );
      expect(turnStartReq.params.threadId).toBe("thread-chat-456");
      expect(turnStartReq.params.input).toEqual([
        { type: "text", text: "hello" },
      ]);
    });

    it("auto-approves MCP tool calls", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/tool/requestUserInput", {
              id: "approval-1",
              toolName: "query_entities",
              threadId: "thread-1",
              turnId: "turn-1",
            });
          });
        }
        if (method === "item/tool/approveUserInput" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => emitTurnCompleted());
        }
      });

      for await (const _event of streamChat("hello", "system", "gpt-4o")) {
        // drain
      }

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const approvalReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("item/tool/approveUserInput"))!.trim(),
      );
      expect(approvalReq.params.approved).toBe(true);
      expect(approvalReq.params.id).toBe("approval-1");
    });

    it("rejects file/command approvals with a warning", async () => {
      const { serverWarn } = await import("../../../utils/ai-logger");
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/fileChange/requestApproval", {
              id: "file-approval-1",
              path: "/etc/passwd",
              threadId: "thread-1",
              turnId: "turn-1",
            });
          });
        }
        if (method === "item/fileChange/respondApproval" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => emitTurnCompleted());
        }
      });

      for await (const _event of streamChat("hello", "system", "gpt-4o")) {
        // drain
      }

      expect(serverWarn).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "approval-rejected",
        expect.objectContaining({
          method: "item/fileChange/requestApproval",
          approvalId: "file-approval-1",
        }),
      );

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const rejectionReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("respondApproval"))!.trim(),
      );
      expect(rejectionReq.params.approved).toBe(false);
      expect(rejectionReq.params.reason).toBe(
        "File/command operations are not permitted in the current trust tier",
      );
    });

    it("sends turn/interrupt with threadId and turnId when aborted", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      const abortController = new AbortController();
      const events: ChatEvent[] = [];
      setTimeout(() => abortController.abort(), 50);

      for await (const event of streamChat("hello", "system", "gpt-4o", {
        signal: abortController.signal,
      })) {
        events.push(event);
      }

      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "error" }),
      );

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const interruptReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("turn/interrupt"))!.trim(),
      );
      expect(interruptReq.params).toEqual({
        threadId: "thread-1",
        turnId: "turn-1",
      });
    });

    it("interrupts after 50 tool calls", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            for (let index = 0; index < 50; index += 1) {
              emitNotification("item/mcpToolCall/progress", {
                toolName: `tool_${index}`,
                input: {},
                threadId: "thread-1",
                turnId: "turn-1",
              });
            }
          });
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      const events: ChatEvent[] = [];
      for await (const event of streamChat("hello", "system", "gpt-4o")) {
        events.push(event);
        if (event.type === "error") break;
      }

      expect(events.filter((event) => event.type === "tool_call_start")).toHaveLength(50);
      const errorEvent = events.find((event) => event.type === "error") as
        | { type: "error"; message: string }
        | undefined;
      expect(errorEvent?.message).toContain("exceeded 50 tool calls");

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const interruptReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("turn/interrupt"))!.trim(),
      );
      expect(interruptReq.params).toEqual({
        threadId: "thread-1",
        turnId: "turn-1",
      });
    });

    it("interrupts after timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      const events: ChatEvent[] = [];
      const consumePromise = (async () => {
        for await (const event of streamChat("hello", "system", "gpt-4o", {
          timeoutMs: 5 * 60 * 1000,
        })) {
          events.push(event);
        }
      })();

      vi.advanceTimersByTime(5 * 60 * 1000 + 2000);
      await Promise.resolve();
      await consumePromise;

      const errorEvent = events.find((event) => event.type === "error") as
        | { type: "error"; message: string }
        | undefined;
      expect(errorEvent?.message).toContain("timed out");
    });

    it("ignores notifications with a different threadId", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (respondToChatConfig(method, id)) return;
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/agentMessage/delta", {
              delta: "wrong thread",
              threadId: "thread-other",
              turnId: "turn-1",
            });
            emitNotification("item/agentMessage/delta", {
              delta: "correct thread",
              threadId: "thread-1",
              turnId: "turn-1",
            });
            emitNotification("item/agentMessage/delta", {
              delta: " no filter",
            });
            emitTurnCompleted();
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const event of streamChat("hello", "system", "gpt-4o")) {
        events.push(event);
      }

      const textEvents = events.filter((event) => event.type === "text_delta");
      expect(textEvents).toContainEqual({
        type: "text_delta",
        content: "correct thread",
      });
      expect(textEvents).toContainEqual({
        type: "text_delta",
        content: " no filter",
      });
      expect(textEvents).not.toContainEqual({
        type: "text_delta",
        content: "wrong thread",
      });
    });
  });

  describe("runAnalysisPhase", () => {
    it("sends outputSchema and parses JSON from the completed agent message", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      const schema = {
        type: "object",
        properties: { entities: { type: "array" } },
      };
      const expected = { entities: [{ id: "e1" }] };

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitItemCompleted({
              id: "agent-msg-1",
              type: "agentMessage",
              text: JSON.stringify(expected),
              phase: "final_answer",
            });
            emitTurnCompleted();
          });
        }
      });

      const result = await runAnalysisPhase(
        "analyze this",
        "system",
        "gpt-4o",
        schema,
      );

      expect(result).toEqual(expected);

      expect(mockInstallMcpServer).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ["/mock/dist/mcp-server.cjs"],
        expect.objectContaining({
          enabledTools: [
            "get_entity",
            "query_entities",
            "query_relationships",
            "request_loopback",
          ],
        }),
      );
      expect(mockInstallMcpServer).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        ["/mock/dist/mcp-server.cjs"],
        expect.objectContaining({
          enabledTools: [
            "get_entity",
            "query_entities",
            "query_relationships",
            "request_loopback",
            "start_analysis",
            "get_analysis_status",
            "create_entity",
            "update_entity",
            "delete_entity",
            "create_relationship",
            "delete_relationship",
            "rerun_phases",
            "abort_analysis",
          ],
        }),
      );

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const reloadReq = JSON.parse(
        calls
          .map((call) => call[0])
          .find((call) => call.includes('"config/mcpServer/reload"'))!
          .trim(),
      );
      expect(reloadReq.params).toEqual({});

      const turnStartReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("outputSchema"))!.trim(),
      );
      expect(turnStartReq.params.outputSchema).toEqual(schema);
      expect(turnStartReq.params.input).toEqual([
        { type: "text", text: "analyze this" },
      ]);
    });

    it("passes threadId from thread/start to turn/start using the official payload shape", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id, "thread-abc-123");
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-analysis-1");
          queueMicrotask(() => {
            emitItemCompleted(
              {
                id: "agent-msg-2",
                type: "agentMessage",
                text: '{"entities":[]}',
                phase: "final_answer",
              },
              "thread-abc-123",
              "turn-analysis-1",
            );
            emitTurnCompleted("thread-abc-123", "turn-analysis-1");
          });
        }
      });

      await runAnalysisPhase("test", "system", "gpt-4o", {});

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const reloadIndex = calls.findIndex((call) =>
        call[0].includes('"config/mcpServer/reload"'),
      );
      const listIndex = calls.findIndex((call) =>
        call[0].includes('"mcpServerStatus/list"'),
      );
      const threadStartIndex = calls.findIndex((call) =>
        call[0].includes('"thread/start"'),
      );
      expect(reloadIndex).toBeGreaterThan(-1);
      expect(listIndex).toBeGreaterThan(reloadIndex);
      expect(threadStartIndex).toBeGreaterThan(listIndex);

      const threadStartReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes('"thread/start"'))!.trim(),
      );
      expect(threadStartReq.params.developerInstructions).toBe("system");
      expect(threadStartReq.params.config).toEqual({ web_search: "live" });

      const turnStartReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes('"turn/start"'))!.trim(),
      );
      expect(turnStartReq.params.threadId).toBe("thread-abc-123");
      expect(turnStartReq.params.input).toEqual([
        { type: "text", text: "test" },
      ]);
    });

    it("approves only read-only MCP tool calls during analysis", async () => {
      const { serverLog } = await import("../../../utils/ai-logger");
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/tool/requestUserInput", {
              id: "mcp-approval-1",
              toolName: "query_entities",
              threadId: "thread-1",
              turnId: "turn-1",
            });
            emitNotification("item/mcpToolCall/progress", {
              toolName: "query_entities",
              input: { phase: "situational-grounding" },
              threadId: "thread-1",
              turnId: "turn-1",
            });
            emitNotification("item/started", {
              item: {
                type: "webSearch",
                query: "latest developments",
              },
              threadId: "thread-1",
              turnId: "turn-1",
            });
          });
        }
        if (method === "item/tool/approveUserInput" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitItemCompleted({
              id: "agent-msg-3",
              type: "agentMessage",
              text: '{"entities":[]}',
              phase: "final_answer",
            });
            emitTurnCompleted();
          });
        }
      });

      const result = await runAnalysisPhase(
        "analyze this",
        "system",
        "gpt-4o",
        {},
      );

      expect(result).toEqual({ entities: [] });

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const approvalReq = JSON.parse(
        calls.map((call) => call[0]).find((call) => call.includes("item/tool/approveUserInput"))!.trim(),
      );
      expect(approvalReq.params.approved).toBe(true);
      expect(approvalReq.params.reason).toBe(
        "Approved analysis read-only MCP tool",
      );

      expect(serverLog).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-tool-approval",
        expect.objectContaining({
          approvalId: "mcp-approval-1",
          toolName: "query_entities",
          approved: true,
        }),
      );
      expect(serverLog).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-mcp-tool-call",
        expect.objectContaining({
          toolName: "query_entities",
        }),
      );
      expect(serverLog).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-web-search",
        expect.objectContaining({
          query: "latest developments",
        }),
      );
    });

    it("rejects non-MCP approvals during analysis", async () => {
      const { serverWarn } = await import("../../../utils/ai-logger");
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitNotification("item/fileChange/requestApproval", {
              id: "file-approval-1",
              path: "/tmp/file.txt",
              threadId: "thread-1",
              turnId: "turn-1",
            });
          });
        }
        if (method === "item/fileChange/respondApproval" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitItemCompleted({
              id: "agent-msg-4",
              type: "agentMessage",
              text: '{"entities":[]}',
              phase: "final_answer",
            });
            emitTurnCompleted();
          });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}),
      ).rejects.toThrow(
        "Codex turn failed: Analysis rejected item/fileChange/requestApproval during structured-output turn",
      );

      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const rejectionReq = JSON.parse(
        calls
          .map((call) => call[0])
          .find((call) => call.includes("item/fileChange/respondApproval"))!
          .trim(),
      );
      expect(rejectionReq.params.approved).toBe(false);
      expect(serverWarn).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-approval-rejected",
        expect.objectContaining({
          method: "item/fileChange/requestApproval",
          approvalId: "file-approval-1",
        }),
      );
    });

    it("surfaces failed turn completion details with status and codex error info", async () => {
      const { serverLog } = await import("../../../utils/ai-logger");
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-analysis-failed");
          queueMicrotask(() => {
            emitTurnCompleted("thread-1", "turn-analysis-failed", "failed", {
              message: "Aborted",
              additionalDetails: "output schema validation failed upstream",
              codexErrorInfo: { code: "model_aborted", retryable: true },
            });
          });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}),
      ).rejects.toThrow(
        'Codex turn failed: Aborted (status=failed; additionalDetails=output schema validation failed upstream; codexErrorInfo={"code":"model_aborted","retryable":true})',
      );

      expect(serverLog).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-turn-completed",
        expect.objectContaining({
          turnId: "turn-analysis-failed",
          status: "failed",
          errorMessage: "Aborted",
          additionalDetails: "output schema validation failed upstream",
          codexErrorInfo: { code: "model_aborted", retryable: true },
        }),
      );
    });

    it("surfaces server error notifications during analysis", async () => {
      const { serverWarn } = await import("../../../utils/ai-logger");
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-analysis-error");
          queueMicrotask(() => {
            emitErrorNotification(
              {
                message: "Model refused output schema",
                additionalDetails: "invalid_json_schema",
                codexErrorInfo: { type: "schema_refusal" },
              },
              "thread-1",
              "turn-analysis-error",
            );
          });
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}),
      ).rejects.toThrow(
        'Codex turn failed: Model refused output schema (additionalDetails=invalid_json_schema; codexErrorInfo={"type":"schema_refusal"})',
      );

      expect(serverWarn).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "analysis-error-notification",
        expect.objectContaining({
          turnId: "turn-analysis-error",
          message: "Model refused output schema",
          additionalDetails: "invalid_json_schema",
          codexErrorInfo: { type: "schema_refusal" },
        }),
      );
    });

    it("keeps a local abort as plain Aborted", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      const controller = new AbortController();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-analysis-abort");
          queueMicrotask(() => controller.abort());
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}, {
          signal: controller.signal,
        }),
      ).rejects.toThrow(/^Aborted$/);
    });

    it("throws when restoring the chat MCP surface fails", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      let reloadCount = 0;
      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          reloadCount += 1;
          if (reloadCount === 1) {
            emitResponse(id, { ok: true });
            return;
          }
          const line =
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32000,
                message: "restore failed",
              },
            }) + "\n";
          mockChild.stdout.emit("data", Buffer.from(line));
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id);
          queueMicrotask(() => {
            emitItemCompleted({
              id: "agent-msg-restore",
              type: "agentMessage",
              text: '{"entities":[]}',
              phase: "final_answer",
            });
            emitTurnCompleted();
          });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}),
      ).rejects.toThrow(/restore failed/);
    });

    it("keeps the primary turn failure when MCP restore also fails", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      let reloadCount = 0;
      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "config/mcpServer/reload" && id !== undefined) {
          reloadCount += 1;
          if (reloadCount === 1) {
            emitResponse(id, { ok: true });
            return;
          }
          const line =
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32000,
                message: "restore failed",
              },
            }) + "\n";
          mockChild.stdout.emit("data", Buffer.from(line));
        }
        if (method === "mcpServerStatus/list" && id !== undefined) {
          emitResponse(id, {
            data: [
              {
                name: "game_theory_analyzer_mcp",
                tools: {
                  get_entity: {},
                  query_entities: {},
                  query_relationships: {},
                  request_loopback: {},
                },
              },
            ],
          });
        }
        if (method === "thread/start" && id !== undefined) {
          emitThreadStartResponse(id);
        }
        if (method === "turn/start" && id !== undefined) {
          emitTurnStartResponse(id, "turn-analysis-primary-error");
          queueMicrotask(() => {
            emitTurnCompleted(
              "thread-1",
              "turn-analysis-primary-error",
              "failed",
              { message: "Aborted" },
            );
          });
        }
      });

      await expect(
        runAnalysisPhase("analyze", "system", "gpt-4o", {}),
      ).rejects.toThrow("Codex turn failed: Aborted (status=failed)");
    });
  });

  describe("stopAppServer", () => {
    it("kills subprocess", async () => {
      const {
        startAppServer,
        stopAppServer,
        _resetConnection,
        _getConnection,
      } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
      });

      await startAppServer("test-run");
      expect(_getConnection()).not.toBeNull();

      const stopPromise = stopAppServer("test-run");
      setTimeout(() => {
        mockChild.emit("close", 0);
      }, 10);
      await stopPromise;

      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });
});
