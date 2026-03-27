// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bindContextMock = vi.fn();
const disconnectMock = vi.fn();
const listeners: Array<(event: unknown) => void> = [];

vi.mock("@/services/ai/workspace-runtime-client", () => ({
  workspaceRuntimeClient: {
    bindContext: (...args: unknown[]) => bindContextMock(...args),
    sendRequest: vi.fn(),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    subscribe: (listener: (event: unknown) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
  },
}));

vi.mock("@/utils/app-storage", () => ({
  appStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("pending turn tool call lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    bindContextMock.mockReset();
    disconnectMock.mockReset();
    listeners.splice(0, listeners.length);
  });

  afterEach(async () => {
    const { useThreadStore } = await import("@/stores/thread-store");
    useThreadStore.setState(useThreadStore.getInitialState(), true);
  });

  it("tracks tool calls within the pending turn", async () => {
    const { useThreadStore } = await import("@/stores/thread-store");

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "user-1", content: "test", timestamp: 100 },
        { id: "assistant-1", content: "", timestamp: 101, isStreaming: true },
      );

    useThreadStore.getState().addPendingToolCall({
      id: "tool-search-1",
      toolName: "search",
      status: "running",
      content: "Using search",
    });

    expect(useThreadStore.getState().pendingTurn?.toolCalls).toHaveLength(1);
    expect(useThreadStore.getState().pendingTurn?.toolCalls[0]?.status).toBe(
      "running",
    );

    useThreadStore.getState().updatePendingToolCall("tool-search-1", {
      status: "done",
      content: "Used search",
    });

    expect(useThreadStore.getState().pendingTurn?.toolCalls[0]?.status).toBe(
      "done",
    );
    expect(useThreadStore.getState().pendingTurn?.toolCalls[0]?.content).toBe(
      "Used search",
    );
  });

  it("marks tool call as error", async () => {
    const { useThreadStore } = await import("@/stores/thread-store");

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "user-1", content: "test", timestamp: 100 },
        { id: "assistant-1", content: "", timestamp: 101, isStreaming: true },
      );

    useThreadStore.getState().addPendingToolCall({
      id: "tool-calc-1",
      toolName: "calc",
      status: "running",
      content: "Using calc",
    });

    useThreadStore.getState().updatePendingToolCall("tool-calc-1", {
      status: "error",
      content: "Tool calc failed: timeout",
    });

    expect(useThreadStore.getState().pendingTurn?.toolCalls[0]).toMatchObject({
      status: "error",
      content: "Tool calc failed: timeout",
    });
  });

  it("completePendingTurn transitions to reconciling", async () => {
    const { useThreadStore } = await import("@/stores/thread-store");

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "user-1", content: "test", timestamp: 100 },
        {
          id: "assistant-1",
          content: "response",
          timestamp: 101,
          isStreaming: true,
        },
      );

    useThreadStore.getState().completePendingTurn("server-msg-1");

    const turn = useThreadStore.getState().pendingTurn;
    expect(turn?.status).toBe("reconciling");
    expect(turn?.serverAssistantMessageId).toBe("server-msg-1");
    expect(turn?.assistantMessage.isStreaming).toBe(false);
  });

  it("clearPendingTurn removes the pending turn", async () => {
    const { useThreadStore } = await import("@/stores/thread-store");

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "user-1", content: "test", timestamp: 100 },
        { id: "assistant-1", content: "", timestamp: 101, isStreaming: true },
      );
    expect(useThreadStore.getState().pendingTurn).not.toBeNull();

    useThreadStore.getState().clearPendingTurn();
    expect(useThreadStore.getState().pendingTurn).toBeNull();
  });
});
