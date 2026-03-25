import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ENV_PREFIX = "GAME_THEORY_ANALYSIS_RUNTIME_";

function resetAnalysisRuntimeEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith(ENV_PREFIX)) {
      delete process.env[key];
    }
  }
}

async function importResolver() {
  vi.resetModules();
  return import("../analysis-runtime-resolver");
}

describe("analysis-runtime-resolver", () => {
  afterEach(() => {
    resetAnalysisRuntimeEnv();
  });

  it("defaults webSearch to enabled and effortLevel to medium when overrides are omitted", async () => {
    resetAnalysisRuntimeEnv();

    const { resolveAnalysisRuntime } = await importResolver();

    expect(resolveAnalysisRuntime()).toEqual({
      webSearch: true,
      effortLevel: "medium",
    });
  });

  it("uses the explicit webSearch=false override", async () => {
    resetAnalysisRuntimeEnv();

    const { resolveAnalysisRuntime } = await importResolver();

    expect(resolveAnalysisRuntime({ webSearch: false })).toEqual({
      webSearch: false,
      effortLevel: "medium",
    });
  });

  it("uses the explicit webSearch=true override", async () => {
    resetAnalysisRuntimeEnv();
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_WEB_SEARCH_ENABLED =
      "false";

    const { resolveAnalysisRuntime } = await importResolver();

    expect(resolveAnalysisRuntime({ webSearch: true })).toEqual({
      webSearch: true,
      effortLevel: "medium",
    });
  });

  it("normalizes the legacy effortLevel=quick override", async () => {
    resetAnalysisRuntimeEnv();

    const { resolveAnalysisRuntime } = await importResolver();

    expect(resolveAnalysisRuntime({ effortLevel: "quick" })).toEqual({
      webSearch: true,
      effortLevel: "low",
    });
  });

  it("normalizes the legacy effortLevel=thorough override", async () => {
    resetAnalysisRuntimeEnv();

    const { resolveAnalysisRuntime } = await importResolver();

    expect(resolveAnalysisRuntime({ effortLevel: "thorough" })).toEqual({
      webSearch: true,
      effortLevel: "high",
    });
  });
});
