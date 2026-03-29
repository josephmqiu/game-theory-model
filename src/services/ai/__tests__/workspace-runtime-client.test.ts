// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalWebSocket = globalThis.WebSocket;
const originalWindowWebSocket =
  typeof window !== "undefined" ? window.WebSocket : undefined;

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
      topicRevisions: {
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
    if (typeof window !== "undefined") {
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    }
  });

  afterEach(async () => {
    const { workspaceRuntimeClient } =
      await import("../workspace-runtime-client");
    expect(() => workspaceRuntimeClient.resetForTest()).not.toThrow();
    MockWebSocket.reset();
    vi.useRealTimers();
    if (originalWebSocket) {
      globalThis.WebSocket = originalWebSocket;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).WebSocket;
    }
    if (typeof window !== "undefined") {
      if (originalWindowWebSocket) {
        window.WebSocket = originalWindowWebSocket;
      } else {
        delete (window as Partial<typeof window>).WebSocket;
      }
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
      lastSeenByTopic: {
        threads: 0,
        "thread-detail": 0,
        "run-detail": 0,
        analysis: 0,
        chat: 0,
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

    // Emit a push message with revision 5 on the "threads" topic
    firstSocket.emitMessage({
      type: "push",
      topic: "threads",
      revision: 5,
      scope: { workspaceId: "workspace-1" },
      event: { kind: "threads.updated", workspaceId: "workspace-1", threads: [] },
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
      lastSeenByTopic: {
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

  it("streams chat events for the matching correlationId and ignores unrelated pushes", async () => {
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

    const onResolvedThread = vi.fn();
    const consume = (async () => {
      const events = [];
      for await (const event of workspaceRuntimeClient.streamChatTurn(
        {
          workspaceId: "workspace-1",
          threadId: "thread-1",
          correlationId: "corr-1",
          message: { content: "hello" },
          provider: "codex",
          model: "gpt-5.4",
        },
        {
          onResolvedThread,
        },
      )) {
        events.push(event);
      }
      return events;
    })();

    const request = JSON.parse(socket.sent.at(-1) ?? "{}");
    expect(request).toMatchObject({
      type: "request",
      kind: "chat.turn.start",
      payload: expect.objectContaining({
        correlationId: "corr-1",
      }),
    });

    socket.emitMessage({
      type: "push",
      topic: "chat",
      revision: 1,
      scope: { workspaceId: "workspace-1", threadId: "thread-1" },
      event: {
        kind: "chat.message.delta",
        correlationId: "other-correlation",
        content: "ignore me",
        contentKind: "text",
      },
    });
    socket.emitMessage({
      type: "response",
      requestId: request.requestId,
      ok: true,
      result: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        correlationId: "corr-1",
      },
    });
    socket.emitMessage({
      type: "push",
      topic: "chat",
      revision: 1,
      scope: { workspaceId: "workspace-1", threadId: "thread-1" },
      event: {
        kind: "chat.message.delta",
        correlationId: "corr-1",
        content: "hello ",
        contentKind: "text",
      },
    });
    socket.emitMessage({
      type: "push",
      topic: "chat",
      revision: 2,
      scope: { workspaceId: "workspace-1", threadId: "thread-1" },
      event: {
        kind: "chat.message.complete",
        correlationId: "corr-1",
        content: "hello world",
      },
    });

    await expect(consume).resolves.toEqual([
      {
        kind: "chat.message.delta",
        correlationId: "corr-1",
        content: "hello ",
        contentKind: "text",
      },
      {
        kind: "chat.message.complete",
        correlationId: "corr-1",
        content: "hello world",
      },
    ]);
    expect(onResolvedThread).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      threadId: "thread-1",
      correlationId: "corr-1",
    });
  });

  it("re-announces active chat correlations in reconnect hello", async () => {
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

    const consume = (async () => {
      for await (const _event of workspaceRuntimeClient.streamChatTurn({
        workspaceId: "workspace-1",
        threadId: "thread-1",
        correlationId: "corr-1",
        message: { content: "hello" },
        provider: "codex",
        model: "gpt-5.4",
      })) {
        // drain
      }
    })();

    firstSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(1000);

    const secondSocket = MockWebSocket.latest();
    secondSocket.emitOpen();

    expect(JSON.parse(secondSocket.sent[0])).toMatchObject({
      type: "client_hello",
      connectionId: "conn-1",
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
      activeChatCorrelations: ["corr-1"],
    });

    secondSocket.emitMessage(bootstrapPayload("conn-2"));
    secondSocket.emitMessage({
      type: "push",
      topic: "chat",
      revision: 1,
      scope: { workspaceId: "workspace-1", threadId: "thread-1" },
      event: {
        kind: "chat.message.complete",
        correlationId: "corr-1",
        content: "done",
      },
    });

    await expect(consume).resolves.toBeUndefined();
  });

  it("completes a chat turn from a replayed terminal push even if the start response is lost", async () => {
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

    const onResolvedThread = vi.fn();
    const consume = (async () => {
      const events = [];
      for await (const event of workspaceRuntimeClient.streamChatTurn(
        {
          workspaceId: "workspace-1",
          threadId: "thread-1",
          correlationId: "corr-1",
          message: { content: "hello" },
          provider: "codex",
          model: "gpt-5.4",
        },
        {
          onResolvedThread,
        },
      )) {
        events.push(event);
      }
      return events;
    })();

    firstSocket.emitClose({ code: 1006, reason: "drop" });
    vi.advanceTimersByTime(1000);

    const secondSocket = MockWebSocket.latest();
    secondSocket.emitOpen();
    secondSocket.emitMessage(bootstrapPayload("conn-2"));
    secondSocket.emitMessage({
      type: "push",
      topic: "chat",
      revision: 1,
      replayed: true,
      scope: { workspaceId: "workspace-1", threadId: "thread-2" },
      event: {
        kind: "chat.message.complete",
        correlationId: "corr-1",
        messageId: "server-msg-1",
        content: "hello world",
      },
    });

    await expect(consume).resolves.toEqual([
      {
        kind: "chat.message.complete",
        correlationId: "corr-1",
        messageId: "server-msg-1",
        content: "hello world",
      },
    ]);
    expect(onResolvedThread).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      threadId: "thread-2",
      correlationId: "corr-1",
    });
  });

  describe("outbound request queueing", () => {
    it("queues requests when socket is CONNECTING and flushes on open", async () => {
      const { workspaceRuntimeClient } =
        await import("../workspace-runtime-client");
      const bootstrapPromise = workspaceRuntimeClient.bindContext({
        workspaceId: "workspace-1",
        activeThreadId: "thread-1",
      });
      const socket = MockWebSocket.latest();

      // Socket is still CONNECTING — sendRequest should NOT throw
      const requestPromise = workspaceRuntimeClient.sendRequest<{
        thread: { id: string };
      }>("workspace.thread.create", {
        workspaceId: "workspace-1",
        title: "New thread",
      });

      // Nothing sent yet (socket not open)
      expect(socket.sent).toHaveLength(0);

      // Open the socket — should flush hello + queued request
      socket.emitOpen();
      socket.emitMessage(bootstrapPayload("conn-1"));
      await bootstrapPromise;

      expect(socket.sent).toHaveLength(2);
      expect(JSON.parse(socket.sent[0])).toMatchObject({
        type: "client_hello",
      });
      const flushedRequest = JSON.parse(socket.sent[1]);
      expect(flushedRequest).toMatchObject({
        type: "request",
        kind: "workspace.thread.create",
      });

      // Respond to the request
      socket.emitMessage({
        type: "response",
        requestId: flushedRequest.requestId,
        ok: true,
        result: { thread: { id: "thread-2" } },
      });

      await expect(requestPromise).resolves.toEqual({
        thread: { id: "thread-2" },
      });
    });

    it("rejects queued request on timeout if socket never opens", async () => {
      const { workspaceRuntimeClient } =
        await import("../workspace-runtime-client");
      // Catch bootstrap rejection — it also times out when we advance timers.
      workspaceRuntimeClient
        .bindContext({
          workspaceId: "workspace-1",
          activeThreadId: "thread-1",
        })
        .catch(() => {});
      const socket = MockWebSocket.latest();

      const requestPromise = workspaceRuntimeClient.sendRequest(
        "workspace.thread.create",
        { workspaceId: "workspace-1", title: "New thread" },
      );

      // Advance past the 10s request timeout
      vi.advanceTimersByTime(10_000);
      await expect(requestPromise).rejects.toThrow("timed out");

      // Now open the socket — timed-out request should NOT be flushed
      socket.emitOpen();
      expect(socket.sent).toHaveLength(1); // only client_hello
      expect(JSON.parse(socket.sent[0])).toMatchObject({
        type: "client_hello",
      });
    });

    it("rejects queued requests on disconnect", async () => {
      const { workspaceRuntimeClient } =
        await import("../workspace-runtime-client");
      // Catch bootstrap rejection — disconnect rejects it.
      workspaceRuntimeClient
        .bindContext({
          workspaceId: "workspace-1",
          activeThreadId: "thread-1",
        })
        .catch(() => {});

      const requestPromise = workspaceRuntimeClient.sendRequest(
        "workspace.thread.create",
        { workspaceId: "workspace-1", title: "New thread" },
      );

      workspaceRuntimeClient.disconnect();
      await expect(requestPromise).rejects.toThrow("disconnected");
    });

    it("flushes multiple queued requests in FIFO order", async () => {
      const { workspaceRuntimeClient } =
        await import("../workspace-runtime-client");
      const bootstrapPromise = workspaceRuntimeClient.bindContext({
        workspaceId: "workspace-1",
        activeThreadId: "thread-1",
      });
      const socket = MockWebSocket.latest();

      const p1 = workspaceRuntimeClient.sendRequest("workspace.thread.create", {
        workspaceId: "workspace-1",
        title: "First",
      });
      const p2 = workspaceRuntimeClient.sendRequest("workspace.thread.rename", {
        workspaceId: "workspace-1",
        threadId: "t-1",
        title: "Second",
      });
      const p3 = workspaceRuntimeClient.sendRequest("workspace.thread.delete", {
        workspaceId: "workspace-1",
        threadId: "t-2",
      });

      socket.emitOpen();
      socket.emitMessage(bootstrapPayload("conn-1"));
      await bootstrapPromise;

      // sent[0] = client_hello, sent[1..3] = queued requests in order
      expect(socket.sent).toHaveLength(4);
      expect(JSON.parse(socket.sent[1])).toMatchObject({
        kind: "workspace.thread.create",
      });
      expect(JSON.parse(socket.sent[2])).toMatchObject({
        kind: "workspace.thread.rename",
      });
      expect(JSON.parse(socket.sent[3])).toMatchObject({
        kind: "workspace.thread.delete",
      });

      // Respond to all three
      for (let i = 1; i <= 3; i++) {
        const req = JSON.parse(socket.sent[i]);
        socket.emitMessage({
          type: "response",
          requestId: req.requestId,
          ok: true,
          result: {},
        });
      }

      await expect(p1).resolves.toEqual({});
      await expect(p2).resolves.toEqual({});
      await expect(p3).resolves.toEqual({});
    });

    it("queues requests during reconnect backoff and flushes on reconnect", async () => {
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

      // Close the socket — triggers reconnect backoff
      firstSocket.emitClose({ code: 1006, reason: "drop" });

      // Queue a request during the backoff window
      const requestPromise = workspaceRuntimeClient.sendRequest<{
        thread: { id: string };
      }>("workspace.thread.create", {
        workspaceId: "workspace-1",
        title: "Queued during reconnect",
      });

      // Advance past the 1000ms backoff
      vi.advanceTimersByTime(1000);
      const secondSocket = MockWebSocket.latest();
      expect(MockWebSocket.instances).toHaveLength(2);

      secondSocket.emitOpen();

      // sent[0] = client_hello, sent[1] = flushed request
      expect(secondSocket.sent).toHaveLength(2);
      const flushedRequest = JSON.parse(secondSocket.sent[1]);
      expect(flushedRequest).toMatchObject({
        type: "request",
        kind: "workspace.thread.create",
      });

      secondSocket.emitMessage({
        type: "response",
        requestId: flushedRequest.requestId,
        ok: true,
        result: { thread: { id: "thread-3" } },
      });

      await expect(requestPromise).resolves.toEqual({
        thread: { id: "thread-3" },
      });
    });

    it("records request-queued and request-flushed diagnostics", async () => {
      const { workspaceRuntimeClient } =
        await import("../workspace-runtime-client");
      const bootstrapPromise = workspaceRuntimeClient.bindContext({
        workspaceId: "workspace-1",
        activeThreadId: "thread-1",
      });
      const socket = MockWebSocket.latest();

      // Catch — we only care about diagnostics, not the response.
      workspaceRuntimeClient
        .sendRequest("workspace.thread.create", {
          workspaceId: "workspace-1",
          title: "New thread",
        })
        .catch(() => {});

      const diagnosticsBeforeOpen = workspaceRuntimeClient.getDiagnostics();
      expect(
        diagnosticsBeforeOpen.some((d) => d.code === "request-queued"),
      ).toBe(true);
      expect(
        diagnosticsBeforeOpen.some((d) => d.code === "request-flushed"),
      ).toBe(false);

      socket.emitOpen();
      socket.emitMessage(bootstrapPayload("conn-1"));
      await bootstrapPromise;

      const diagnosticsAfterOpen = workspaceRuntimeClient.getDiagnostics();
      expect(
        diagnosticsAfterOpen.some((d) => d.code === "request-flushed"),
      ).toBe(true);
    });
  });
});
