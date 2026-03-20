import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analysis phase executor boundary", () => {
  it("keeps shared analysis-service free of provider adapter imports", () => {
    const source = readFileSync(
      resolve("src/services/ai/analysis-service.ts"),
      "utf-8",
    );

    expect(source).not.toContain("claude-adapter");
    expect(source).not.toContain("codex-adapter");
    expect(source).not.toContain("node:child_process");
    expect(source).not.toContain("node:fs");
  });

  it("owns provider selection in the server executor layer", () => {
    const source = readFileSync(
      resolve("server/utils/analysis-phase-executor.ts"),
      "utf-8",
    );

    expect(source).toContain('provider === "openai"');
    expect(source).toContain("codex-adapter");
    expect(source).toContain("claude-adapter");
  });

  it("registers the server executor into the shared runtime", async () => {
    const runtime = await import("../../src/services/ai/analysis-runtime");
    runtime.setAnalysisPhaseExecutor(null);

    const { configureServerAnalysisPhaseExecutor } = await import(
      "../utils/analysis-phase-executor"
    );

    configureServerAnalysisPhaseExecutor();

    expect(runtime.getAnalysisPhaseExecutor()).not.toBeNull();
  });
});
