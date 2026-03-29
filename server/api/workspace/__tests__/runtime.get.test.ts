import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThreadService,
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";
import { _bindWorkspaceDatabaseForInit } from "../../../services/entity-graph-service";
import { _resetAnalysisEventBridgeForTest } from "../../../services/workspace/analysis-event-bridge";
import { _resetWorkspaceRuntimePublisherForTest } from "../../../services/workspace/workspace-runtime-publisher";
import { _resetWorkspaceRuntimeTransportForTest } from "../../../services/workspace/workspace-runtime-transport";

const getQueryMock = vi.fn();
const streamChatTurnMock = vi.fn();

vi.mock("../../../services/entity-graph-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../services/entity-graph-service")>();
  return {
    ...actual,
    getAnalysis: vi.fn(() => ({
      entities: [],
      relationships: [],
      phases: [],
      id: "analysis-1",
      name: "analysis-1",
      topic: "topic",
    })),
  };
});

vi.mock("../../../services/workspace/provider-session-binding-service", () => ({
  getProviderSessionBinding: vi.fn(() => null),
}));

vi.mock("../../../services/ai/adapter-contract", () => ({
  getRuntimeAdapter: vi.fn(async () => ({
    provider: "codex",
    createSession: vi.fn((context: { threadId: string }) => ({
      provider: "codex",
      context,
      streamChatTurn: (...args: unknown[]) => streamChatTurnMock(...args),
      runStructuredTurn: vi.fn(),
      getDiagnostics: vi.fn(() => ({
        provider: "codex",
        sessionId: "runtime-chat-test",
      })),
      getBinding: vi.fn(() => null),
      dispose: vi.fn(async () => {}),
    })),
    listModels: vi.fn(async () => []),
    checkHealth: vi.fn(async () => ({
      provider: "codex",
      status: "healthy",
      reason: null,
      checkedAt: Date.now(),
      checks: [],
    })),
  })),
}));

vi.mock("h3", () => ({
  defineWebSocketHandler: (hooks: unknown) => hooks,
  defineEventHandler: (handler: unknown) => handler,
  getQuery: (...args: unknown[]) => getQueryMock(...args),
}));

class FakePeer {
  readonly id: string;
  readonly sent: Array<Record<string, unknown>> = [];
  readonly remoteAddress = "127.0.0.1";

  constructor(id: string) {
    this.id = id;
  }

  send(payload: unknown): void {
    this.sent.push(JSON.parse(String(payload)) as Record<string, unknown>);
  }
}

function wsMessage(payload: unknown) {
  return {
    text: () =>
      typeof payload === "string" ? payload : JSON.stringify(payload),
  };
}

describe("/api/workspace/runtime websocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamChatTurnMock.mockImplementation(async function* () {
      yield { type: "text_delta", content: "Hello " };
      yield { type: "text_delta", content: "world" };
    });
    resetWorkspaceDatabaseForTest();
    _bindWorkspaceDatabaseForInit(getWorkspaceDatabase);
    _resetAnalysisEventBridgeForTest();
    _resetWorkspaceRuntimePublisherForTest();
    _resetWorkspaceRuntimeTransportForTest();
  });

  it("sends a projection-backed bootstrap on client hello", async () => {
    const database = getWorkspaceDatabase();
    const threadService = createThreadService(database);
    const thread = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Trade war",
      producer: "test",
      occurredAt: 100,
    });
    threadService.recordMessage({
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      role: "user",
      content: "Analyze incentives",
      producer: "test",
      occurredAt: 101,
    });

    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );

    expect(peer.sent[0]).toMatchObject({
      type: "bootstrap",
      payload: {
        workspaceId: "workspace-1",
        activeThreadId: thread.id,
        activeThreadDetail: {
          thread: expect.objectContaining({
            id: thread.id,
            title: "Trade war",
          }),
          messages: [
            expect.objectContaining({
              role: "user",
              content: "Analyze incentives",
            }),
          ],
          activities: [],
        },
        latestRun: null,
        latestPhaseTurns: [],
        serverConnectionId: "conn-1",
      },
    });
  });

  it("handles workspace.thread.create and pushes updated thread snapshots", async () => {
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer.sent.splice(0, peer.sent.length);

    await route.message(
      peer,
      wsMessage({
        type: "request",
        requestId: "req-1",
        kind: "workspace.thread.create",
        payload: {
          workspaceId: "workspace-1",
          title: "New thread",
        },
      }),
    );

    expect(peer.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "push",
          channel: "threads",
          payload: expect.objectContaining({
            workspaceId: "workspace-1",
            threads: [
              expect.objectContaining({
                title: "New thread",
              }),
            ],
          }),
        }),
        expect.objectContaining({
          type: "response",
          requestId: "req-1",
          ok: true,
          result: {
            workspaceId: "workspace-1",
            thread: expect.objectContaining({
              title: "New thread",
            }),
          },
        }),
      ]),
    );
  });

  it("returns the canonical analysis snapshot via analysis.state.get", async () => {
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer.sent.splice(0, peer.sent.length);

    await route.message(
      peer,
      wsMessage({
        type: "request",
        requestId: "req-analysis-state",
        kind: "analysis.state.get",
        payload: {
          workspaceId: "workspace-1",
        },
      }),
    );

    expect(peer.sent).toContainEqual(
      expect.objectContaining({
        type: "response",
        requestId: "req-analysis-state",
        ok: true,
        result: expect.objectContaining({
          analysis: expect.objectContaining({
            id: "analysis-1",
            topic: "topic",
          }),
          runStatus: expect.objectContaining({
            status: "idle",
            runId: null,
          }),
          revision: expect.any(Number),
        }),
      }),
    );
  });

  it("rejects invalid analysis.state.get payloads", async () => {
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer.sent.splice(0, peer.sent.length);

    await route.message(
      peer,
      wsMessage({
        type: "request",
        requestId: "req-analysis-state-invalid",
        kind: "analysis.state.get",
        payload: {},
      }),
    );

    expect(peer.sent).toContainEqual({
      type: "response",
      requestId: "req-analysis-state-invalid",
      ok: false,
      error: "Invalid analysis.state.get payload",
    });
  });

  it("replays latest cached pushes on reconnect and exposes diagnostics", async () => {
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
      close: (
        peer: FakePeer,
        details?: { code?: number; reason?: string },
      ) => void;
    };
    const diagnosticsRoute = (await import("../runtime-diagnostics.get"))
      .default;
    const peer1 = new FakePeer("conn-1");

    route.open(peer1);
    await route.message(
      peer1,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer1.sent.splice(0, peer1.sent.length);
    await route.message(
      peer1,
      wsMessage({
        type: "request",
        requestId: "req-1",
        kind: "workspace.thread.create",
        payload: {
          workspaceId: "workspace-1",
          title: "Replay me",
        },
      }),
    );
    // Query per-connection diagnostics before close (close cleans up the map)
    getQueryMock.mockReturnValue({ connectionId: "conn-1" });
    const diagnosticsBeforeClose = diagnosticsRoute({} as never) as {
      byConnectionId: Array<{ code: string }>;
    };

    expect(
      diagnosticsBeforeClose.byConnectionId.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(expect.arrayContaining(["hello-received", "request-completed"]));

    route.close(peer1, { code: 1000, reason: "done" });

    // After close, per-connection diagnostics are cleaned up
    const diagnosticsAfterClose = diagnosticsRoute({} as never) as {
      byConnectionId: Array<{ code: string }>;
      recent: Array<{ code: string }>;
    };
    expect(diagnosticsAfterClose.byConnectionId).toEqual([]);
    expect(diagnosticsAfterClose.recent.map((d) => d.code)).toEqual(
      expect.arrayContaining(["close"]),
    );

    const peer2 = new FakePeer("conn-2");
    route.open(peer2);
    await route.message(
      peer2,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
        lastSeenByChannel: {
          threads: 0,
        },
      }),
    );

    expect(peer2.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "bootstrap",
        }),
        expect.objectContaining({
          type: "push",
          channel: "threads",
          replayed: true,
        }),
      ]),
    );
  });

  it("pushes analysis status updates over the workspace runtime websocket after client_hello", async () => {
    const runtimeStatus = await import("../../../services/runtime-status");
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer.sent.splice(0, peer.sent.length);

    expect(
      runtimeStatus.acquireRun("analysis", "run-analysis-ws", {
        totalPhases: 9,
      }),
    ).toBe(true);

    expect(peer.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "push",
          channel: "analysis-status",
          scope: { workspaceId: "workspace-1" },
          payload: {
            runStatus: expect.objectContaining({
              status: "running",
              kind: "analysis",
              runId: "run-analysis-ws",
              progress: { completed: 0, total: 9 },
            }),
          },
        }),
      ]),
    );

    runtimeStatus.releaseRun("run-analysis-ws", "cancelled");
  });

  it("forwards explicit activeThreadId in bootstrap", async () => {
    const database = getWorkspaceDatabase();
    const threadService = createThreadService(database);
    const threadA = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Thread A",
      producer: "test",
      occurredAt: 100,
    });
    const threadB = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Thread B",
      producer: "test",
      occurredAt: 101,
    });

    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer = new FakePeer("conn-1");

    route.open(peer);
    await route.message(
      peer,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
        activeThreadId: threadB.id,
      }),
    );

    expect(peer.sent[0]).toMatchObject({
      type: "bootstrap",
      payload: {
        activeThreadId: threadB.id,
        activeThreadDetail: {
          thread: expect.objectContaining({
            title: "Thread B",
          }),
        },
      },
    });

    // Ensure it picked threadB, not threadA
    expect(peer.sent[0]).not.toMatchObject({
      payload: { activeThreadId: threadA.id },
    });
  });

  it("accepts chat.turn.start and only pushes live chat events to the matching correlation subscriber", async () => {
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
    };
    const peer1 = new FakePeer("conn-1");
    const peer2 = new FakePeer("conn-2");

    route.open(peer1);
    route.open(peer2);
    await route.message(
      peer1,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    await route.message(
      peer2,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer1.sent.splice(0, peer1.sent.length);
    peer2.sent.splice(0, peer2.sent.length);

    await route.message(
      peer1,
      wsMessage({
        type: "request",
        requestId: "req-chat-1",
        kind: "chat.turn.start",
        payload: {
          workspaceId: "workspace-1",
          correlationId: "corr-1",
          message: {
            content: "hello",
          },
          provider: "codex",
          model: "gpt-5.4",
        },
      }),
    );

    await vi.waitFor(() => {
      expect(
        peer1.sent.some(
          (entry) =>
            entry.type === "response" &&
            entry.requestId === "req-chat-1" &&
            entry.ok === true &&
            (entry.result as { workspaceId?: string; correlationId?: string })
              ?.workspaceId === "workspace-1" &&
            (entry.result as { correlationId?: string })?.correlationId ===
              "corr-1",
        ),
      ).toBe(true);
      expect(
        peer1.sent.some(
          (entry) =>
            entry.type === "push" &&
            entry.channel === "chat-event" &&
            (entry.payload as { correlationId?: string; event?: { type?: string; content?: string } })
              ?.correlationId === "corr-1" &&
            (entry.payload as { event?: { type?: string; content?: string } })
              ?.event?.type === "chat.message.delta" &&
            (entry.payload as { event?: { content?: string } })?.event
              ?.content === "Hello ",
        ),
      ).toBe(true);
      expect(
        peer1.sent.some(
          (entry) =>
            entry.type === "push" &&
            entry.channel === "chat-event" &&
            (entry.payload as { correlationId?: string; event?: { type?: string; content?: string } })
              ?.correlationId === "corr-1" &&
            (entry.payload as { event?: { type?: string; content?: string } })
              ?.event?.type === "chat.message.complete" &&
            (entry.payload as { event?: { content?: string } })?.event
              ?.content === "Hello world",
        ),
      ).toBe(true);
    });
    expect(
      peer2.sent.some(
        (entry) => entry.type === "push" && entry.channel === "chat-event",
      ),
    ).toBe(false);

    const chatStartResponse = peer1.sent.find(
      (entry) => entry.type === "response" && entry.requestId === "req-chat-1",
    ) as { result: { threadId: string } } | undefined;
    expect(chatStartResponse?.result.threadId).toBeTruthy();

    const peer3 = new FakePeer("conn-3");
    route.open(peer3);
    await route.message(
      peer3,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
        activeThreadId: chatStartResponse?.result.threadId,
        lastSeenByChannel: {
          threads: 0,
          "thread-detail": 0,
          "run-detail": 0,
        },
      }),
    );
    expect(
      peer3.sent.some(
        (entry) => entry.type === "push" && entry.channel === "chat-event",
      ),
    ).toBe(false);
  });

  it("replays a terminal chat push for active correlations after reconnect", async () => {
    streamChatTurnMock.mockImplementation(async function* () {
      await new Promise(() => {});
    });

    const { publishWorkspaceRuntimeChatEvent } = await import(
      "../../../services/workspace/workspace-runtime-chat-publisher"
    );
    const route = (await import("../runtime.get")).default as unknown as {
      open: (peer: FakePeer) => void;
      message: (
        peer: FakePeer,
        message: ReturnType<typeof wsMessage>,
      ) => Promise<void>;
      close: (
        peer: FakePeer,
        details?: { code?: number; reason?: string },
      ) => void;
    };
    const peer1 = new FakePeer("conn-1");

    route.open(peer1);
    await route.message(
      peer1,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
      }),
    );
    peer1.sent.splice(0, peer1.sent.length);

    await route.message(
      peer1,
      wsMessage({
        type: "request",
        requestId: "req-chat-1",
        kind: "chat.turn.start",
        payload: {
          workspaceId: "workspace-1",
          correlationId: "corr-1",
          message: {
            content: "hello",
          },
          provider: "codex",
          model: "gpt-5.4",
        },
      }),
    );

    await vi.waitFor(() => {
      expect(
        peer1.sent.some(
          (entry) =>
            entry.type === "response" &&
            entry.requestId === "req-chat-1" &&
            entry.ok === true,
        ),
      ).toBe(true);
    });

    const startResponse = peer1.sent.find(
      (entry) => entry.type === "response" && entry.requestId === "req-chat-1",
    ) as { result: { threadId: string } } | undefined;
    expect(startResponse?.result.threadId).toBeTruthy();

    route.close(peer1, { code: 1006, reason: "drop" });

    publishWorkspaceRuntimeChatEvent({
      workspaceId: "workspace-1",
      threadId: startResponse!.result.threadId,
      correlationId: "corr-1",
      event: {
        type: "chat.message.complete",
        correlationId: "corr-1",
        messageId: "server-msg-1",
        content: "Hello world",
      },
    });

    const peer2 = new FakePeer("conn-2");
    route.open(peer2);
    await route.message(
      peer2,
      wsMessage({
        type: "client_hello",
        workspaceId: "workspace-1",
        activeThreadId: startResponse?.result.threadId,
        activeChatCorrelations: ["corr-1"],
      }),
    );

    expect(peer2.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "bootstrap",
        }),
        expect.objectContaining({
          type: "push",
          channel: "chat-event",
          replayed: true,
          payload: {
            correlationId: "corr-1",
            event: {
              type: "chat.message.complete",
              correlationId: "corr-1",
              messageId: "server-msg-1",
              content: "Hello world",
            },
          },
        }),
      ]),
    );
  });
});
