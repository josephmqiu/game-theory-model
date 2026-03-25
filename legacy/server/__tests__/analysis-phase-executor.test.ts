import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analysis-service boundary", () => {
  it("keeps analysis-service free of renderer bridge imports", () => {
    const source = readFileSync(
      resolve("server/services/analysis-service.ts"),
      "utf-8",
    );

    expect(source).not.toContain("analysis-runtime");
    expect(source).not.toContain("analysis-phase-executor");
    expect(source).not.toContain("node:child_process");
    expect(source).not.toContain("node:fs");
  });

  it("owns provider selection directly in analysis-service", () => {
    const source = readFileSync(
      resolve("server/services/analysis-service.ts"),
      "utf-8",
    );

    expect(source).toContain('provider === "openai"');
    expect(source).toContain("codex-adapter");
    expect(source).toContain("claude-adapter");
  });

  it("removes the executor bridge files", () => {
    expect(() =>
      readFileSync(resolve("server/utils/analysis-phase-executor.ts")),
    ).toThrow();
    expect(() =>
      readFileSync(resolve("src/services/ai/analysis-runtime.ts")),
    ).toThrow();
  });
});
