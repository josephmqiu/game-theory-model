import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClaudeRunAnalysisPhase = vi.fn();
const mockCodexRunAnalysisPhase = vi.fn();

vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: mockClaudeRunAnalysisPhase,
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: mockCodexRunAnalysisPhase,
}));

describe("analysis-phase-executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes anthropic requests through the Claude adapter", async () => {
    const { serverAnalysisPhaseExecutor } = await import(
      "../analysis-phase-executor"
    );
    mockClaudeRunAnalysisPhase.mockResolvedValue({ entities: [] });

    const result = await serverAnalysisPhaseExecutor.runPhase({
      provider: "anthropic",
      prompt: "prompt",
      systemPrompt: "system",
      model: "claude-sonnet",
      schema: { type: "object" },
    });

    expect(result).toEqual({ entities: [] });
    expect(mockClaudeRunAnalysisPhase).toHaveBeenCalledWith(
      "prompt",
      "system",
      "claude-sonnet",
      { type: "object" },
      undefined,
    );
    expect(mockCodexRunAnalysisPhase).not.toHaveBeenCalled();
  });

  it("routes openai requests through the Codex adapter", async () => {
    const { serverAnalysisPhaseExecutor } = await import(
      "../analysis-phase-executor"
    );
    mockCodexRunAnalysisPhase.mockResolvedValue({ relationships: [] });

    const result = await serverAnalysisPhaseExecutor.runPhase({
      provider: "openai",
      prompt: "prompt",
      systemPrompt: "system",
      model: "gpt-5.4",
      schema: { type: "object" },
    });

    expect(result).toEqual({ relationships: [] });
    expect(mockCodexRunAnalysisPhase).toHaveBeenCalledWith(
      "prompt",
      "system",
      "gpt-5.4",
      { type: "object" },
      undefined,
    );
    expect(mockClaudeRunAnalysisPhase).not.toHaveBeenCalled();
  });

  it("rejects unknown providers", async () => {
    const { serverAnalysisPhaseExecutor } = await import(
      "../analysis-phase-executor"
    );

    await expect(
      serverAnalysisPhaseExecutor.runPhase({
        provider: "copilot",
        prompt: "prompt",
        systemPrompt: "system",
        model: "bad-model",
        schema: { type: "object" },
      }),
    ).rejects.toThrow("Unknown provider: copilot");
  });
});
