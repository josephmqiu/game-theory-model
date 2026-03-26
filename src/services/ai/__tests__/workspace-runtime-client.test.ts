// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalWebSocket = globalThis.WebSocket;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  static latest(): MockWebSocket {
    const latest = MockWebSocket.instances.at(-1);
    if (!latest) {
      throw new Error("No websocket instance");
    }
    return latest;
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.listeners
      .get("open")
      ?.forEach((listener) => listener(new Event("open")));
  }

  emitMessage(payload: unknown): void {
    this.listeners.get("message")?.forEach((listener) =>
      listener({
        data: JSON.stringify(payload),
      }),
    );
  }

  emitClose(details: { code?: number; reason?: string } = {}): void {
    this.readyState = MockWebSocket.CLOSED;
    this.listeners.get("close")?.forEach((listener) =>
      listener({
        code: details.code ?? 1000,
        reason: details.reason ?? "",
      }),
    );
  }
}

function bootstrapPayload(connectionId = "conn-1") {
  return {
    type: "bootstrap",
    payload: {
      workspaceId: "workspace-1",
      threads: [],
      activeThreadId: "thread-1",
      activeThreadDetail: null,
      latestRun: null,
      latestPhaseTurns: [],
      channelRevisions: {
        threads: 1,
      },
      serverConnectionId: connectionId,
    },
  };
}

describe("workspace-runtime-client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    workspaceRuntimeClient.resetForTest();
    MockWebSocket.reset();
    vi.useRealTimers();
    if (originalWebSocket) {
      globalThis.WebSocket = originalWebSocket;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).WebSocket;
    }
  });

  it("sends client hello and resolves bootstrap", async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    const bootstrapPromise = workspaceRuntimeClient.bindContext({
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });
    const socket = MockWebSocket.latest();

    socket.emitOpen();
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: "client_hello",
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
      lastSeenByChannel: {
        threads: 0,
        "thread-detail": 0,
        "run-detail": 0,
      },
    });

    socket.emitMessage(bootstrapPayload());
    await expect(bootstrapPromise).resolves.toMatchObject({
      workspaceId: "workspace-1",
      serverConnectionId: "conn-1",
    });
  });

  it("reconnects with exponential backoff after close", async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    const bootstrapPromise = workspaceRuntimeClient.bindContext({
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });
    const firstSocket = MockWebSocket.latest();
    firstSocket.emitOpen();
    firstSocket.emitMessage(bootstrapPayload("conn-1"));
    await bootstrapPromise;

    firstSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    const secondSocket = MockWebSocket.latest();
    secondSocket.emitOpen();

    expect(JSON.parse(secondSocket.sent[0])).toMatchObject({
      type: "client_hello",
      connectionId: "conn-1",
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });

    // 2nd socket was opened so reconnectAttempt reset to 0.
    // Close it — backoff = RECONNECT_BACKOFF_MS[0] = 1000ms, then attempt becomes 1
    secondSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);
    const thirdSocket = MockWebSocket.latest();
    // Do NOT open the 3rd socket — so reconnectAttempt stays at 1.
    // Close it — backoff = RECONNECT_BACKOFF_MS[1] = 2000ms, then attempt becomes 2
    thirdSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances).toHaveLength(3);

    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(4);
    const fourthSocket = MockWebSocket.latest();
    // Open the 4th socket — reconnectAttempt resets to 0
    fourthSocket.emitOpen();

    // Close the 4th socket — backoff should be 1000ms again (reset on open)
    fourthSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(999);
    expect(MockWebSocket.instances).toHaveLength(4);

    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(5);
  });

  it("rejects pending requests when disconnect is called", async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    const bootstrapPromise = workspaceRuntimeClient.bindContext({
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });
    const socket = MockWebSocket.latest();
    socket.emitOpen();
    socket.emitMessage(bootstrapPayload("conn-1"));
    await bootstrapPromise;

    const requestPromise = workspaceRuntimeClient.sendRequest(
      "workspace.thread.create",
      { workspaceId: "workspace-1", title: "New thread" },
    );

    // Disconnect while the request is still pending
    workspaceRuntimeClient.disconnect();

    await expect(requestPromise).rejects.toThrow("disconnected");
  });

  it("carries latest push revision in reconnect hello", async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    const bootstrapPromise = workspaceRuntimeClient.bindContext({
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });
    const firstSocket = MockWebSocket.latest();
    firstSocket.emitOpen();
    firstSocket.emitMessage(bootstrapPayload("conn-1"));
    await bootstrapPromise;

    // Emit a push message with revision 5 on the "threads" channel
    firstSocket.emitMessage({
      type: "push",
      channel: "threads",
      revision: 5,
      scope: { workspaceId: "workspace-1" },
      payload: { workspaceId: "workspace-1", threads: [] },
    });

    // Close the socket to trigger reconnect
    firstSocket.emitClose({ code: 1006, reason: "drop" });

    // Advance past the 1000ms backoff
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);

    const secondSocket = MockWebSocket.latest();
    secondSocket.emitOpen();

    const hello = JSON.parse(secondSocket.sent[0]);
    expect(hello).toMatchObject({
      type: "client_hello",
      connectionId: "conn-1",
      workspaceId: "workspace-1",
      lastSeenByChannel: {
        threads: 5,
      },
    });
  });

  it("tracks pending requests, reports mismatches, and resolves matching responses", async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    const bootstrapPromise = workspaceRuntimeClient.bindContext({
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
    });
    const socket = MockWebSocket.latest();
    socket.emitOpen();
    socket.emitMessage(bootstrapPayload("conn-1"));
    await bootstrapPromise;

    const requestPromise = workspaceRuntimeClient.sendRequest<{
      workspaceId: string;
      thread: { id: string };
    }>("workspace.thread.create", {
      workspaceId: "workspace-1",
      title: "New thread",
    });

    const request = JSON.parse(socket.sent.at(-1) ?? "{}");
    socket.emitMessage({
      type: "response",
      requestId: "other-request",
      ok: true,
      result: {},
    });
    socket.emitMessage({
      type: "response",
      requestId: request.requestId,
      ok: true,
      result: {
        workspaceId: "workspace-1",
        thread: {
          id: "thread-2",
        },
      },
    });

    await expect(requestPromise).resolves.toEqual({
      workspaceId: "workspace-1",
      thread: {
        id: "thread-2",
      },
    });
    expect(
      workspaceRuntimeClient
        .getDiagnostics()
        .some((diagnostic) => diagnostic.code === "response-mismatch"),
    ).toBe(true);
  });
});
