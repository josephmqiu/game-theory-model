import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThreadService,
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";
import { _bindWorkspaceDatabaseForInit } from "../../../services/entity-graph-service";
import { _resetWorkspaceRuntimePublisherForTest } from "../../../services/workspace/workspace-runtime-publisher";
import { _resetWorkspaceRuntimeTransportForTest } from "../../../services/workspace/workspace-runtime-transport";

const getQueryMock = vi.fn();

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
    resetWorkspaceDatabaseForTest();
    _bindWorkspaceDatabaseForInit(getWorkspaceDatabase);
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
});
