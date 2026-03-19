import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChatEvent } from "../chat-events";
import { EventEmitter } from "node:events";

// ── Mock child_process ──

class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(() => true),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  exitCode: number | null = null;
  pid = 12345;

  kill = vi.fn(() => {
    return true;
  });
}

let mockChild: MockChildProcess;

// Handler that will be installed before spawn is called
let stdinHandler:
  | ((method: string, id: number | undefined, params: unknown) => void)
  | null = null;

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    mockChild = new MockChildProcess();
    // Wire up the auto-responder if one was installed before spawn
    if (stdinHandler) {
      const handler = stdinHandler;
      mockChild.stdin.write.mockImplementation((...args: unknown[]) => {
        const data = args[0] as string;
        try {
          const parsed = JSON.parse(data.trim());
          queueMicrotask(() =>
            handler(parsed.method, parsed.id, parsed.params),
          );
        } catch {
          // ignore non-JSON
        }
        return true;
      });
    }
    return mockChild;
  }),
}));

vi.mock("../../../../server/utils/codex-client", () => ({
  filterCodexEnv: vi.fn((env: Record<string, string | undefined>) => {
    const result: Record<string, string | undefined> = {};
    if (env.PATH) result.PATH = env.PATH;
    if (env.HOME) result.HOME = env.HOME;
    for (const [k, v] of Object.entries(env)) {
      if (k.startsWith("OPENAI_") || k.startsWith("CODEX_")) {
        result[k] = v;
      }
    }
    return result;
  }),
}));

vi.mock("../../../../server/utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

vi.mock("../codex-config", () => ({
  installMcpServer: vi.fn(),
  uninstallMcpServer: vi.fn(),
  registerCleanupHandler: vi.fn(() => vi.fn()),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(() => true),
  };
});

// ── Helpers ──

/** Simulate the app-server sending a JSON-RPC response */
function emitResponse(id: number, result: unknown) {
  const line = JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
  mockChild.stdout.emit("data", Buffer.from(line));
}

/** Simulate the app-server sending a notification */
function emitNotification(method: string, params: Record<string, unknown>) {
  const line = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
  mockChild.stdout.emit("data", Buffer.from(line));
}

/**
 * Set up an auto-responder that will be installed on the mock child's stdin
 * when spawn is called. Must be called BEFORE the adapter calls spawn.
 */
function setAutoResponder(
  handler: (method: string, id: number | undefined, params: unknown) => void,
) {
  stdinHandler = handler;
}

// ── Tests ──

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
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
      });

      const conn = await startAppServer("test-run");

      // Verify spawn was called with correct args
      expect(spawn).toHaveBeenCalledWith(
        "codex",
        ["app-server"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );

      // Verify initialize request was sent
      expect(mockChild.stdin.write).toHaveBeenCalled();
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const firstWrite = calls[0][0];
      const initReq = JSON.parse(firstWrite.trim());
      expect(initReq.method).toBe("initialize");
      expect(initReq.jsonrpc).toBe("2.0");
      expect(initReq.id).toBeDefined();

      // Verify initialized notification was sent after response
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const secondWrite = calls[1][0];
      const initNotif = JSON.parse(secondWrite.trim());
      expect(initNotif.method).toBe("initialized");
      expect(initNotif.id).toBeUndefined();

      expect(conn).toBeDefined();
      expect(conn.process).toBe(mockChild);
    });
  });

  describe("streamChat", () => {
    it("yields text_delta from agentMessage/delta notifications", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("item/agentMessage/delta", { delta: "Hello " });
            emitNotification("item/agentMessage/delta", { delta: "world" });
            emitNotification("turn/completed", { content: "" });
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "system", "gpt-4o")) {
        events.push(ev);
      }

      expect(events).toContainEqual({ type: "text_delta", content: "Hello " });
      expect(events).toContainEqual({ type: "text_delta", content: "world" });
    });

    it("yields turn_complete on turn/completed", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {});
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "system", "gpt-4o")) {
        events.push(ev);
      }

      expect(events).toContainEqual({ type: "turn_complete" });
    });

    it("auto-approves MCP tool calls", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("item/tool/requestUserInput", {
              id: "approval-1",
              toolName: "get_entities",
            });
          });
        }
        if (method === "item/tool/approveUserInput" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {});
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "system", "gpt-4o")) {
        events.push(ev);
      }

      // Verify approval was sent
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const approvalWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes("item/tool/approveUserInput"));
      expect(approvalWrite).toBeDefined();
      const approvalReq = JSON.parse(approvalWrite!.trim());
      expect(approvalReq.params.approved).toBe(true);
      expect(approvalReq.params.id).toBe("approval-1");
    });

    it("rejects file/command approvals with logged warning", async () => {
      const { serverWarn } = await import("../../../../server/utils/ai-logger");
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("item/fileChange/requestApproval", {
              id: "file-approval-1",
              path: "/etc/passwd",
            });
          });
        }
        if (method === "item/fileChange/respondApproval" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {});
          });
        }
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "system", "gpt-4o")) {
        events.push(ev);
      }

      // Verify warning was logged
      expect(serverWarn).toHaveBeenCalledWith(
        undefined,
        "codex-adapter",
        "approval-rejected",
        expect.objectContaining({
          method: "item/fileChange/requestApproval",
          approvalId: "file-approval-1",
        }),
      );

      // Verify rejection was sent with the correct trust-tier message
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const rejectionWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes("respondApproval"));
      expect(rejectionWrite).toBeDefined();
      const rejectionReq = JSON.parse(rejectionWrite!.trim());
      expect(rejectionReq.params.approved).toBe(false);
      expect(rejectionReq.params.reason).toBe(
        "File/command operations are not permitted in the current trust tier",
      );
    });

    it("interrupts after 50 tool calls", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            for (let i = 0; i < 50; i++) {
              emitNotification("item/mcpToolCall/progress", {
                toolName: `tool_${i}`,
                input: {},
              });
            }
          });
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      const events: ChatEvent[] = [];
      for await (const ev of streamChat("hello", "system", "gpt-4o")) {
        events.push(ev);
        if (ev.type === "error") break;
      }

      // Should have tool_call_start events and then an error
      const toolStarts = events.filter((e) => e.type === "tool_call_start");
      expect(toolStarts.length).toBe(50);

      const errors = events.filter((e) => e.type === "error");
      expect(errors.length).toBe(1);
      expect((errors[0] as { message: string }).message).toContain(
        "exceeded 50 tool calls",
      );

      // Verify turn/interrupt was sent
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const interruptWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes("turn/interrupt"));
      expect(interruptWrite).toBeDefined();
    });

    it("interrupts after 5-minute timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          // Don't send turn/completed — let it time out
        }
        if (method === "turn/interrupt" && id !== undefined) {
          emitResponse(id, { ok: true });
        }
      });

      const events: ChatEvent[] = [];
      const gen = streamChat("hello", "system", "gpt-4o", {
        timeoutMs: 5 * 60 * 1000,
      });

      const consumePromise = (async () => {
        for await (const ev of gen) {
          events.push(ev);
        }
      })();

      // Advance time past the 5-minute timeout
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 2000);
      await consumePromise;

      const errors = events.filter((e) => e.type === "error");
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect((errors[0] as { message: string }).message).toContain("timed out");
    });
  });

  describe("runAnalysisPhase", () => {
    it("sends outputSchema and returns parsed result", async () => {
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
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: "thread-1" });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {
              structuredOutput: expected,
            });
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

      // Verify outputSchema was sent in turn/start
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const turnStartWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes("outputSchema"));
      expect(turnStartWrite).toBeDefined();
      const turnStartReq = JSON.parse(turnStartWrite!.trim());
      expect(turnStartReq.params.outputSchema).toEqual(schema);
    });

    // Regression: turn/start must include threadId from thread/start response (ISSUE-002).
    it("passes threadId from thread/start to turn/start", async () => {
      const { runAnalysisPhase, _resetConnection } =
        await import("../codex-adapter");
      _resetConnection();

      const EXPECTED_THREAD_ID = "thread-abc-123";

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: EXPECTED_THREAD_ID });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {
              structuredOutput: { entities: [] },
            });
          });
        }
      });

      await runAnalysisPhase("test", "system", "gpt-4o", {});

      // Find the turn/start request and verify threadId is present
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const turnStartWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes('"turn/start"'));
      expect(turnStartWrite).toBeDefined();
      const turnStartReq = JSON.parse(turnStartWrite!.trim());
      expect(turnStartReq.params.threadId).toBe(EXPECTED_THREAD_ID);
    });
  });

  // Regression: streamChat must also pass threadId to turn/start (ISSUE-002).
  describe("streamChat threadId", () => {
    it("passes threadId from thread/start to turn/start", async () => {
      const { streamChat, _resetConnection } = await import("../codex-adapter");
      _resetConnection();

      const EXPECTED_THREAD_ID = "thread-chat-456";

      setAutoResponder((method, id) => {
        if (method === "initialize" && id !== undefined) {
          emitResponse(id, { protocolVersion: "1.0" });
        }
        if (method === "thread/start" && id !== undefined) {
          emitResponse(id, { threadId: EXPECTED_THREAD_ID });
        }
        if (method === "turn/start" && id !== undefined) {
          emitResponse(id, { ok: true });
          queueMicrotask(() => {
            emitNotification("turn/completed", {});
          });
        }
      });

      // Consume the generator
      for await (const _ev of streamChat("hello", "system", "gpt-4o")) {
        // drain
      }

      // Find the turn/start request and verify threadId
      const calls = mockChild.stdin.write.mock.calls as unknown as string[][];
      const turnStartWrite = calls
        .map((c) => c[0])
        .find((w) => w.includes('"turn/start"'));
      expect(turnStartWrite).toBeDefined();
      const turnStartReq = JSON.parse(turnStartWrite!.trim());
      expect(turnStartReq.params.threadId).toBe(EXPECTED_THREAD_ID);
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

      // Stop — need to emit close event after kill
      const stopPromise = stopAppServer("test-run");
      setTimeout(() => {
        mockChild.emit("close", 0);
      }, 10);
      await stopPromise;

      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });
});
