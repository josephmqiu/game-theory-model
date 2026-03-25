import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const getRequestHeaderMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();
const runCodexExecMock = vi.fn();

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
  runCodexExec: (...args: unknown[]) => runCodexExecMock(...args),
}));

vi.mock("../../../utils/resolve-claude-agent-env", () => ({
  buildClaudeAgentEnv: () => ({}),
  getClaudeAgentDebugFilePath: () => undefined,
}));

vi.mock("../chat", () => ({
  formatOpenCodeError: () => "open-code-error",
}));

vi.mock("../../../utils/ai-logger", () => ({
  serverError: vi.fn(),
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
}));

describe("/api/ai/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeaderMock.mockReturnValue(undefined);
    runCodexExecMock.mockResolvedValue({ text: "answer" });
  });

  it("returns 400 when the request body is malformed", async () => {
    readBodyMock.mockResolvedValue({
      system: {},
      message: "hello",
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../generate")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error:
        "Missing or invalid required fields: system, message, provider, model",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("routes a valid openai request through Codex", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      message: "hello",
      provider: "openai",
      model: "gpt-5.4",
    });

    const route = (await import("../generate")).default;
    const result = await route({} as never);

    expect(runCodexExecMock).toHaveBeenCalledWith("hello", {
      model: "gpt-5.4",
      systemPrompt: "system",
      thinkingMode: undefined,
      thinkingBudgetTokens: undefined,
      effort: undefined,
      runId: undefined,
    });
    expect(result).toEqual({ text: "answer" });
  });
});
