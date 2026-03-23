import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const getRequestHeaderMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();
const serverLogMock = vi.fn();
const getAnalysisMock = vi.fn();
const codexStreamChatMock = vi.fn();

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
  streamChat: vi.fn(),
}));

vi.mock("../../../services/ai/codex-adapter", () => ({
  streamChat: (...args: unknown[]) => codexStreamChatMock(...args),
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
    codexStreamChatMock.mockImplementation(async function* () {});
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
});
