import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const getRequestHeaderMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();
const runCodexExecMock = vi.fn();
const customGenerateTextMock = vi.fn();

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

vi.mock("../../../services/ai/custom-openai-adapter", () => ({
  generateText: (...args: unknown[]) => customGenerateTextMock(...args),
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

  it("routes a valid custom request through the custom adapter", async () => {
    customGenerateTextMock.mockResolvedValue("custom answer");
    readBodyMock.mockResolvedValue({
      system: "system",
      message: "hello",
      provider: "custom",
      model: "my-model",
      custom: {
        baseURL: "https://api.example.com/v1",
        apiKey: "k",
        hasNativeWebSearch: false,
      },
    });

    const route = (await import("../generate")).default;
    const result = await route({} as never);

    expect(customGenerateTextMock).toHaveBeenCalledTimes(1);
    const input = customGenerateTextMock.mock.calls[0][0] as {
      baseURL: string;
      message: string;
    };
    expect(input.baseURL).toBe("https://api.example.com/v1");
    expect(input.message).toBe("hello");
    expect(result).toEqual({ text: "custom answer" });
  });

  it("returns 400 for a custom request missing creds", async () => {
    readBodyMock.mockResolvedValue({
      system: "system",
      message: "hello",
      provider: "custom",
      model: "my-model",
    });

    const route = (await import("../generate")).default;
    await route({} as never);

    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(customGenerateTextMock).not.toHaveBeenCalled();
  });
});
