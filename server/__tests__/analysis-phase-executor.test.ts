import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("analysis-service boundary", () => {
  it("keeps analysis-service free of renderer bridge imports", () => {
    const source = readFileSync(
      resolve("server/services/analysis-service.ts"),
      "utf-8",
    );

    expect(source).not.toContain("analysis-phase-executor");
    expect(source).not.toContain("node:child_process");
    expect(source).not.toContain("node:fs");
  });

  it("resolves providers through the runtime adapter contract", () => {
    const source = readFileSync(
      resolve("server/services/analysis-service.ts"),
      "utf-8",
    );

    expect(source).toContain("loadRuntimeAdapter");
    expect(source).toContain("createSession");
    expect(source).not.toContain("../ai/claude-adapter");
    expect(source).not.toContain("../ai/codex-adapter");
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
