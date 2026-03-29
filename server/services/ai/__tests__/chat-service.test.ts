import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRuntimeEventByTopic } from "../../../../shared/types/workspace-runtime";

const getAnalysisMock = vi.fn();
const codexStreamChatMock = vi.fn();
const ensureThreadMock = vi.fn();
const listMessagesByThreadIdMock = vi.fn();
const recordMessageMock = vi.fn();
const recordActivityMock = vi.fn();
let lastSessionKey:
  | {
      workspaceId?: string;
      threadId?: string;
      runId?: string;
      purpose?: string;
    }
  | undefined;

vi.mock("../../entity-graph-service", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
}));

vi.mock("../../workspace/thread-service", () => ({
  createThreadService: vi.fn(() => ({
    ensureThread: (...args: unknown[]) => ensureThreadMock(...args),
    listMessagesByThreadId: (...args: unknown[]) =>
      listMessagesByThreadIdMock(...args),
    recordMessage: (...args: unknown[]) => recordMessageMock(...args),
    recordActivity: (...args: unknown[]) => recordActivityMock(...args),
  })),
  deriveThreadTitleFromMessage: vi.fn(() => "Derived thread"),
}));

vi.mock("../../workspace/provider-session-binding-service", () => ({
  getProviderSessionBinding: vi.fn(() => null),
}));

vi.mock("../adapter-contract", () => ({
  getRuntimeAdapter: vi.fn(async () => ({
    provider: "codex",
    createSession(key: {
      workspaceId: string;
      threadId: string;
      runId?: string;
      purpose?: string;
    }) {
      lastSessionKey = key;
      return {
        provider: "codex",
        context: key,
        streamChatTurn: (...args: unknown[]) => codexStreamChatMock(...args),
        runStructuredTurn: vi.fn(),
        getDiagnostics: vi.fn(() => ({
          provider: "codex",
          sessionId: "test-chat-session",
        })),
        getBinding: vi.fn(() => null),
        dispose: vi.fn(async () => {}),
      };
    },
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

describe("chat-service.startChatTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const messages: Array<{
      id: string;
      workspaceId: string;
      threadId: string;
      role: "user" | "assistant";
      content: string;
      attachments?: Array<{ name: string; mediaType: string; data: string }>;
      createdAt: number;
      updatedAt: number;
    }> = [];
    const activities: Array<Record<string, unknown>> = [];

    ensureThreadMock.mockImplementation(
      ({
        workspaceId,
        threadId,
      }: {
        workspaceId?: string;
        threadId?: string;
      }) => ({
        workspaceId: workspaceId ?? "workspace-local-default",
        threadId: threadId ?? "workspace-1:primary-thread",
      }),
    );
    listMessagesByThreadIdMock.mockImplementation((threadId: string) =>
      messages.filter((message) => message.threadId === threadId),
    );
    recordMessageMock.mockImplementation(
      ({
        workspaceId,
        threadId,
        role,
        content,
        attachments,
        messageId,
        occurredAt,
      }: {
        workspaceId: string;
        threadId: string;
        role: "user" | "assistant";
        content: string;
        attachments?: Array<{ name: string; mediaType: string; data: string }>;
        messageId?: string;
        occurredAt?: number;
      }) => {
        const next = {
          id: messageId ?? `msg-${messages.length + 1}`,
          workspaceId,
          threadId,
          role,
          content,
          ...(attachments ? { attachments } : {}),
          createdAt: occurredAt ?? Date.now(),
          updatedAt: occurredAt ?? Date.now(),
        };
        messages.push(next);
        return next;
      },
    );
    recordActivityMock.mockImplementation((activity: Record<string, unknown>) => {
      activities.push(activity);
      return {
        id: `activity-${activities.length}`,
        eventId: `event-${activities.length}`,
        sequence: activities.length,
        ...activity,
      };
    });
    getAnalysisMock.mockReturnValue({
      entities: [],
      relationships: [],
      phases: [],
      id: "analysis-1",
      name: "analysis-1",
      topic: "topic",
    });
    codexStreamChatMock.mockImplementation(async function* () {
      yield { type: "text_delta", content: "Hello " };
      yield {
        type: "tool_call_start",
        toolName: "search",
        input: { query: "trade war" },
      };
      yield {
        type: "tool_call_result",
        toolName: "search",
        output: { hits: 1 },
      };
      yield { type: "text_delta", content: "back" };
    });
    lastSessionKey = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists canonical thread messages and emits chat runtime events", async () => {
    const { startChatTurn } = await import("../chat-service");
    const events: WorkspaceRuntimeEventByTopic["chat"][] = [];

    const started = await startChatTurn(
      {
        workspaceId: "workspace-1",
        correlationId: "corr-1",
        message: { content: "hello" },
        provider: "codex",
        model: "gpt-5.4",
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    await started.completion;

    expect(started).toMatchObject({
      workspaceId: "workspace-1",
      threadId: "workspace-1:primary-thread",
      correlationId: "corr-1",
    });
    expect(lastSessionKey).toMatchObject({
      workspaceId: "workspace-1",
      threadId: "workspace-1:primary-thread",
      purpose: "chat",
    });
    expect(recordMessageMock).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      {
        kind: "chat.message.delta",
        correlationId: "corr-1",
        content: "Hello ",
      },
      {
        kind: "chat.tool.start",
        correlationId: "corr-1",
        toolName: "search",
      },
      {
        kind: "chat.tool.result",
        correlationId: "corr-1",
        toolName: "search",
        output: { hits: 1 },
      },
      {
        kind: "chat.message.delta",
        correlationId: "corr-1",
        content: "back",
      },
      expect.objectContaining({
        kind: "chat.message.complete",
        correlationId: "corr-1",
        content: "Hello back",
        messageId: expect.any(String),
      }),
    ]);
    expect(recordMessageMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            workspaceId: "workspace-1",
            threadId: "workspace-1:primary-thread",
            role: "user",
            content: "hello",
            correlationId: "corr-1",
          }),
        ],
        [
          expect.objectContaining({
            workspaceId: "workspace-1",
            threadId: "workspace-1:primary-thread",
            role: "assistant",
            content: "Hello back",
            correlationId: "corr-1",
          }),
        ],
      ]),
    );
    expect(recordActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        threadId: "workspace-1:primary-thread",
        scope: "chat-turn",
        kind: "web-search",
        status: "completed",
        toolName: "search",
        query: "trade war",
        message: "Used search",
        correlationId: "corr-1",
      }),
    );
  });

  it("records partial assistant output and emits a chat error event when streaming fails", async () => {
    codexStreamChatMock.mockImplementation(async function* () {
      yield { type: "text_delta", content: "Partial " };
      yield { type: "text_delta", content: "response" };
      throw new Error("Connection lost");
    });

    const { startChatTurn } = await import("../chat-service");
    const events: WorkspaceRuntimeEventByTopic["chat"][] = [];

    const started = await startChatTurn(
      {
        workspaceId: "workspace-err",
        correlationId: "corr-err",
        message: { content: "test error path" },
        provider: "codex",
        model: "gpt-5.4",
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    await started.completion;

    expect(events).toEqual([
      {
        kind: "chat.message.delta",
        correlationId: "corr-err",
        content: "Partial ",
      },
      {
        kind: "chat.message.delta",
        correlationId: "corr-err",
        content: "response",
      },
      expect.objectContaining({
        kind: "chat.message.error",
        correlationId: "corr-err",
        error: expect.objectContaining({
          message: "Connection lost",
        }),
      }),
    ]);

    expect(recordMessageMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            role: "user",
            content: "test error path",
          }),
        ],
        [
          expect.objectContaining({
            role: "assistant",
            content: "Partial response",
          }),
        ],
      ]),
    );
    expect(recordActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-err",
        threadId: started.threadId,
        scope: "chat-turn",
        kind: "note",
        status: "failed",
        message: "Connection lost",
        correlationId: "corr-err",
      }),
    );
  });
});
