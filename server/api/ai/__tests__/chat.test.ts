import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "../../../../shared/types/events";

const readBodyMock = vi.fn();
const getRequestHeaderMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();
const serverLogMock = vi.fn();
const getAnalysisMock = vi.fn();
const claudeStreamChatMock = vi.fn();
const codexStreamChatMock = vi.fn();

class MockCodexThreadExpiredError extends Error {
  constructor(message = "codex-thread-expired: thread not found") {
    super(message);
    this.name = "CodexThreadExpiredError";
  }
}

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getRequestHeader: (...args: unknown[]) => getRequestHeaderMock(...args),
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseHeaders: (...args: unknown[]) => setResponseHeadersMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../utils/resolve-claude-cli", () => ({
  resolveClaudeCli: () => "/mock/claude",
}));

vi.mock("../../../utils/codex-client", () => ({
  runCodexExec: vi.fn(),
}));

vi.mock("../../../utils/resolve-claude-agent-env", () => ({
  buildClaudeAgentEnv: () => ({}),
  getClaudeAgentDebugFilePath: () => undefined,
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverLog: (...args: unknown[]) => serverLogMock(...args),
}));

vi.mock("../../../services/entity-graph-service", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
}));

vi.mock("../../../services/ai/claude-adapter", () => ({
  streamChat: (...args: unknown[]) => claudeStreamChatMock(...args),
}));

vi.mock("../../../services/ai/codex-adapter", () => ({
  streamChat: (...args: unknown[]) => codexStreamChatMock(...args),
  CodexThreadExpiredError: MockCodexThreadExpiredError,
  isCodexThreadExpiredError: (error: unknown) =>
    error instanceof MockCodexThreadExpiredError ||
    (error instanceof Error &&
      error.message.startsWith("codex-thread-expired:")),
}));

async function* streamEvents(events: ChatEvent[] = []) {
  for (const event of events) {
    yield event;
  }
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function readSseEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

function asSseResponse(value: unknown): Response {
  if (!(value instanceof Response)) {
    throw new Error("Expected an SSE response");
  }
  return value;
}

describe("/api/ai/chat", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getRequestHeaderMock.mockReturnValue(undefined);
    getAnalysisMock.mockReturnValue({
      entities: [],
      relationships: [],
      phases: [],
      id: "analysis-1",
      name: "analysis-1",
      topic: "topic",
    });
    claudeStreamChatMock.mockImplementation(() => streamEvents());
    codexStreamChatMock.mockImplementation(() => streamEvents());
    const sessions = await import("../../../services/ai/chat-sessions");
    sessions._resetForTest();
  });

  afterEach(async () => {
    vi.useRealTimers();
    const sessions = await import("../../../services/ai/chat-sessions");
    sessions._resetForTest();
  });

  it("returns 400 when messages is not an array", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: "bad-shape",
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error:
        "Missing or invalid required fields: system, messages, provider, model",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("returns 400 for an unsupported provider", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [],
      provider: "opencode",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Missing or unsupported provider. Provider fallback is disabled.",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("dispatches anthropic requests to the claude adapter only", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [{ role: "user", content: "hello" }],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });

    const route = (await import("../chat")).default;
    await asSseResponse(await route({} as never)).text();

    expect(claudeStreamChatMock).toHaveBeenCalledTimes(1);
    expect(codexStreamChatMock).not.toHaveBeenCalled();
  });

  it("dispatches openai requests to the codex adapter only", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [{ role: "user", content: "hello" }],
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    await asSseResponse(await route({} as never)).text();

    expect(codexStreamChatMock).toHaveBeenCalledTimes(1);
    expect(claudeStreamChatMock).not.toHaveBeenCalled();
  });

  it("rejects an allowlisted-but-unregistered provider (custom)", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [{ role: "user", content: "hello" }],
      provider: "custom",
      model: "gpt-4o-mini",
    });

    const route = (await import("../chat")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Missing or unsupported provider. Provider fallback is disabled.",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(claudeStreamChatMock).not.toHaveBeenCalled();
    expect(codexStreamChatMock).not.toHaveBeenCalled();
  });

  it("returns an SSE response for a valid request", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [{ role: "user", content: "hello" }],
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const response = await route({} as never);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected an SSE response");
    }
    expect(setResponseHeadersMock).toHaveBeenCalledWith(expect.anything(), {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    expect(await response.text()).toContain('"type":"done"');
    expect(codexStreamChatMock).toHaveBeenCalled();
  });

  it("creates a runtime session without folding history into the system prompt", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      sessionKey: "analysis-1",
      messages: [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
        { role: "user", content: "latest question" },
      ],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    claudeStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onSessionId?: (id: string) => void },
    ) {
      options?.onSessionId?.("claude-session-1");
      yield { type: "turn_complete" };
    });

    const route = (await import("../chat")).default;
    const response = asSseResponse(await route({} as never));
    await response.text();

    expect(claudeStreamChatMock).toHaveBeenCalledOnce();
    const [prompt, systemPrompt, _model, options] =
      claudeStreamChatMock.mock.calls[0];
    expect(prompt).toBe("latest question");
    expect(systemPrompt).toBe("system");
    expect(systemPrompt).not.toContain("## Conversation History");
    expect(options.resumeSessionId).toBeUndefined();
  });

  it("resumes a Claude runtime session on the second turn", async () => {
    const route = (await import("../chat")).default;
    claudeStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onSessionId?: (id: string) => void },
    ) {
      options?.onSessionId?.("claude-session-1");
      yield { type: "turn_complete" };
    });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    await asSseResponse(await route({} as never)).text();

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "second" },
      ],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    await asSseResponse(await route({} as never)).text();

    expect(claudeStreamChatMock).toHaveBeenCalledTimes(2);
    expect(claudeStreamChatMock.mock.calls[1][0]).toBe("second");
    expect(claudeStreamChatMock.mock.calls[1][3].resumeSessionId).toBe(
      "claude-session-1",
    );
  });

  it("reuses a Codex thread on the second turn", async () => {
    const route = (await import("../chat")).default;
    codexStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onThreadId?: (id: string) => void },
    ) {
      options?.onThreadId?.("thread-1");
      yield { type: "turn_complete" };
    });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "second" },
      ],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    expect(codexStreamChatMock).toHaveBeenCalledTimes(2);
    expect(codexStreamChatMock.mock.calls[1][0]).toBe("second");
    expect(codexStreamChatMock.mock.calls[1][3].existingThreadId).toBe(
      "thread-1",
    );
  });

  it("emits session_expired before streaming after idle expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T00:00:00.000Z"));
    const route = (await import("../chat")).default;
    claudeStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onSessionId?: (id: string) => void },
    ) {
      options?.onSessionId?.("claude-session-new");
      yield { type: "text_delta", content: "fresh" };
      yield { type: "turn_complete" };
    });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    await asSseResponse(await route({} as never)).text();

    vi.advanceTimersByTime(30 * 60 * 1000 + 1);

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "after idle" }],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    const events = await readSseEvents(asSseResponse(await route({} as never)));

    expect(events[0]).toEqual({ type: "session_expired" });
    expect(events).toContainEqual({ type: "text_delta", content: "fresh" });
  });

  it("recreates and marks a Codex session expired when the stored thread is gone", async () => {
    const route = (await import("../chat")).default;
    codexStreamChatMock
      .mockImplementationOnce(async function* (
        _prompt: string,
        _systemPrompt: string,
        _model: string,
        options?: { onThreadId?: (id: string) => void },
      ) {
        options?.onThreadId?.("thread-1");
        yield { type: "turn_complete" };
      })
      .mockImplementationOnce(async function* () {
        throw new MockCodexThreadExpiredError();
      })
      .mockImplementationOnce(async function* (
        _prompt: string,
        _systemPrompt: string,
        _model: string,
        options?: { onThreadId?: (id: string) => void },
      ) {
        options?.onThreadId?.("thread-2");
        yield { type: "text_delta", content: "fresh codex" };
        yield { type: "turn_complete" };
      });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "second" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    const events = await readSseEvents(asSseResponse(await route({} as never)));

    // Keepalive pings now run on resumed sessions too (long-TTFT fix), so the
    // first *meaningful* event — not literally events[0] — must be session_expired.
    const meaningful = events.filter(
      (e) => (e as { type: string }).type !== "ping",
    );
    expect(meaningful[0]).toEqual({ type: "session_expired" });
    expect(events).toContainEqual({
      type: "text_delta",
      content: "fresh codex",
    });
    expect(codexStreamChatMock.mock.calls[1][3].existingThreadId).toBe(
      "thread-1",
    );
    expect(
      codexStreamChatMock.mock.calls[2][3].existingThreadId,
    ).toBeUndefined();
  });

  it("returns 409 for a concurrent turn on the same runtime session", async () => {
    const hold = deferred();
    codexStreamChatMock.mockImplementation(async function* () {
      await hold.promise;
      yield { type: "turn_complete" };
    });

    const route = (await import("../chat")).default;

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    const firstResponse = asSseResponse(await route({} as never));

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "second" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    const secondResult = await route({} as never);

    expect(secondResult).toEqual({
      error: "A turn is already streaming for this session",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 409);
    expect(codexStreamChatMock).toHaveBeenCalledTimes(1);

    hold.resolve();
    await firstResponse.text();
  });

  it("releases the session turn flag after stream completion", async () => {
    const route = (await import("../chat")).default;
    codexStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onThreadId?: (id: string) => void },
    ) {
      options?.onThreadId?.("thread-1");
      yield { type: "turn_complete" };
    });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "second" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    const secondResponse = asSseResponse(await route({} as never));
    await secondResponse.text();

    expect(codexStreamChatMock).toHaveBeenCalledTimes(2);
    expect(setResponseStatusMock).not.toHaveBeenCalledWith(
      expect.anything(),
      409,
    );
  });

  it("releases the session turn flag after a stream error", async () => {
    const route = (await import("../chat")).default;
    codexStreamChatMock
      .mockImplementationOnce(async function* () {
        throw new Error("stream failed");
      })
      .mockImplementationOnce(async function* () {
        yield { type: "turn_complete" };
      });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    const firstEvents = await readSseEvents(
      asSseResponse(await route({} as never)),
    );
    expect(firstEvents).toContainEqual(
      expect.objectContaining({ type: "error", message: "stream failed" }),
    );

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "second" }],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    expect(codexStreamChatMock).toHaveBeenCalledTimes(2);
  });

  it("expires and folds history for the first turn after a provider switch only", async () => {
    const route = (await import("../chat")).default;
    claudeStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onSessionId?: (id: string) => void },
    ) {
      options?.onSessionId?.("claude-session-1");
      yield { type: "turn_complete" };
    });
    codexStreamChatMock.mockImplementation(async function* (
      _prompt: string,
      _systemPrompt: string,
      _model: string,
      options?: { onThreadId?: (id: string) => void },
    ) {
      options?.onThreadId?.("thread-1");
      yield { type: "text_delta", content: "codex answer" };
      yield { type: "turn_complete" };
    });

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [{ role: "user", content: "first question" }],
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    await asSseResponse(await route({} as never)).text();

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
        { role: "user", content: "switch providers" },
      ],
      provider: "openai",
      model: "gpt-5.4",
    });
    const switchEvents = await readSseEvents(
      asSseResponse(await route({} as never)),
    );

    expect(switchEvents[0]).toEqual({ type: "session_expired" });
    expect(codexStreamChatMock.mock.calls[0][0]).toBe("switch providers");
    expect(codexStreamChatMock.mock.calls[0][1]).toContain(
      "## Conversation History",
    );
    expect(codexStreamChatMock.mock.calls[0][1]).toContain(
      "user: first question",
    );
    expect(codexStreamChatMock.mock.calls[0][1]).toContain(
      "assistant: first answer",
    );

    readBodyMock.mockResolvedValueOnce({
      system: "system",
      sessionKey: "analysis-1",
      messages: [
        { role: "user", content: "switch providers" },
        { role: "assistant", content: "codex answer" },
        { role: "user", content: "follow up" },
      ],
      provider: "openai",
      model: "gpt-5.4",
    });
    await asSseResponse(await route({} as never)).text();

    expect(codexStreamChatMock.mock.calls[1][0]).toBe("follow up");
    expect(codexStreamChatMock.mock.calls[1][1]).toBe("system");
  });

  it("keeps legacy history folding when no sessionKey is present", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      messages: [
        { role: "user", content: "first question" },
        { role: "assistant", content: "first answer" },
        { role: "user", content: "latest question" },
      ],
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../chat")).default;
    const response = asSseResponse(await route({} as never));
    await response.text();

    expect(codexStreamChatMock).toHaveBeenCalledOnce();
    const [prompt, systemPrompt] = codexStreamChatMock.mock.calls[0];
    expect(prompt).toBe("latest question");
    expect(systemPrompt).toContain("## Conversation History");
    expect(systemPrompt).toContain("user: first question");
    expect(systemPrompt).toContain("assistant: first answer");
  });

  it("sends less than 30% of legacy prompt bytes on turn 3 with sessions", async () => {
    const { buildLegacyChatPromptParts, buildRuntimeSessionPromptParts } =
      await import("../chat");
    const messages = [
      { role: "user" as const, content: "Turn 1 " + "A".repeat(500) },
      { role: "assistant" as const, content: "Answer 1 " + "B".repeat(500) },
      { role: "user" as const, content: "Turn 2 " + "C".repeat(500) },
      { role: "assistant" as const, content: "Answer 2 " + "D".repeat(500) },
      { role: "user" as const, content: "Turn 3 " + "E".repeat(120) },
      { role: "assistant" as const, content: "" },
    ];
    const body = {
      system: "system prompt",
      messages: messages.slice(0, 5),
    };

    const legacy = buildLegacyChatPromptParts(body);
    const runtime = buildRuntimeSessionPromptParts(body);
    const bytes = (value: string) => new TextEncoder().encode(value).length;
    const legacyBytes = bytes(legacy.prompt) + bytes(legacy.systemPrompt);
    const runtimeBytes = bytes(runtime.prompt) + bytes(runtime.systemPrompt);

    expect(runtimeBytes).toBeLessThan(legacyBytes * 0.3);
  });
});
