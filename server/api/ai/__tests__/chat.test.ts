import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";

const readBodyMock = vi.fn();
const getRequestHeaderMock = vi.fn();
const setResponseStatusMock = vi.fn();
const getAnalysisMock = vi.fn();
const codexStreamChatMock = vi.fn();
let lastSessionKey:
  | {
      workspaceId?: string;
      threadId?: string;
      runId?: string;
      purpose?: string;
    }
  | undefined;

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getRequestHeader: (...args: unknown[]) => getRequestHeaderMock(...args),
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../services/entity-graph-service", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
}));

vi.mock("../../../services/workspace/provider-session-binding-service", () => ({
  getProviderSessionBinding: vi.fn(() => null),
  createProviderSessionBindingService: vi.fn(() => ({
    getBinding: vi.fn(() => null),
    upsertBinding: vi.fn((b: unknown) => b),
    clearBinding: vi.fn(() => false),
    recordDiagnostic: vi.fn(),
    recordOutcome: vi.fn((b: unknown) => b),
  })),
  clearProviderSessionBinding: vi.fn(() => false),
  upsertProviderSessionBinding: vi.fn((b: unknown) => b),
  recordProviderSessionBindingDiagnostic: vi.fn(),
}));

vi.mock("../../../services/ai/adapter-contract", () => ({
  getRuntimeAdapter: vi.fn(async () => ({
    provider: "codex",
    createSession(key: { threadId: string; runId?: string; purpose?: string }) {
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

describe("/api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeaderMock.mockReturnValue(undefined);
    getAnalysisMock.mockReturnValue({
      entities: [],
      relationships: [],
      phases: [],
      id: "analysis-1",
      name: "analysis-1",
      topic: "topic",
    });
    codexStreamChatMock.mockImplementation(async function* () {
      yield { type: "text_delta", content: "Hello back" };
    });
    lastSessionKey = undefined;
  });

  afterEach(() => {
    resetWorkspaceDatabaseForTest();
  });

  it("returns 400 when the request body shape is invalid", async () => {
    readBodyMock.mockResolvedValue({
      provider: "openai",
      model: "gpt-5.4",
      message: "bad-shape",
    });

    const route = (await import("../chat")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Missing or invalid required fields for chat request.",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("creates a durable thread and persists canonical messages for canonical requests", async () => {
    readBodyMock.mockResolvedValue({
      workspaceId: "workspace-1",
      message: { content: "hello" },
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const response = await route({} as never);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected a response");
    }

    const body = await response.text();
    expect(body).toContain('"type":"text_delta"');
    expect(body).toContain('"type":"done"');
    expect(response.headers.get("X-Workspace-Id")).toBe("workspace-1");
    expect(response.headers.get("X-Thread-Id")).toBe(
      "workspace-1:primary-thread",
    );
    expect(lastSessionKey).toMatchObject({
      workspaceId: "workspace-1",
      threadId: "workspace-1:primary-thread",
      purpose: "chat",
    });

    const database = getWorkspaceDatabase();
    const storedMessages = database.messages.listMessagesByThreadId(
      "workspace-1:primary-thread",
    );
    expect(storedMessages).toHaveLength(2);
    expect(
      storedMessages.map((message) => [message.role, message.content]),
    ).toEqual([
      ["user", "hello"],
      ["assistant", "Hello back"],
    ]);
  });

  it("records a failure activity and partial assistant message when streaming throws", async () => {
    codexStreamChatMock.mockImplementation(async function* () {
      yield { type: "text_delta", content: "Partial " };
      yield { type: "text_delta", content: "response" };
      throw new Error("Connection lost");
    });

    readBodyMock.mockResolvedValue({
      workspaceId: "workspace-err",
      message: { content: "test error path" },
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const response = await route({} as never);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected a response");
    }

    const body = await response.text();
    expect(body).toContain('"type":"text_delta"');
    expect(body).toContain('"type":"error"');
    expect(body).toContain("Connection lost");

    const threadId = response.headers.get("X-Thread-Id")!;
    const database = getWorkspaceDatabase();

    const storedMessages = database.messages.listMessagesByThreadId(threadId);
    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[0].content).toBe("test error path");
    expect(storedMessages[1].content).toBe("Partial response");

    const activities = database.activities.listActivitiesByThreadId(threadId);
    expect(activities).toEqual([
      expect.objectContaining({
        scope: "chat-turn",
        kind: "note",
        status: "failed",
        message: "Connection lost",
      }),
    ]);
  });

  it("accepts canonical payloads and writes to the resolved thread", async () => {
    readBodyMock.mockResolvedValue({
      message: { content: "Follow up" },
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const response = await route({} as never);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected a response");
    }
    await response.text();

    const threadId =
      response.headers.get("X-Thread-Id") ??
      "workspace-local-default:primary-thread";
    const storedMessages =
      getWorkspaceDatabase().messages.listMessagesByThreadId(threadId);
    expect(storedMessages.map((message) => message.content)).toEqual([
      "Follow up",
      "Hello back",
    ]);
  });
});
