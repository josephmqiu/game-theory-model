import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  abortAnalysisRun,
  type AnalysisResult,
} from "@/components/editor/analysis-run";

const topBarPath = join(process.cwd(), "src/components/editor/top-bar.tsx");
const landingPath = join(process.cwd(), "src/routes/index.tsx");
const editorRoutePath = join(process.cwd(), "src/routes/editor.tsx");
const englishLocalePath = join(process.cwd(), "src/i18n/locales/en.ts");

describe("editor layout", () => {
  it("renders the analysis shell with the docked AI panel in source", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/editor/editor-layout.tsx"),
      "utf8",
    );

    expect(source).toContain("AIChatPanel");
    expect(source).toContain('mode="analysis"');
    expect(source).toContain('presentation="docked"');
    expect(source).not.toContain("useAnalysisStore");
  });

  it("passes renderer-owned runtime overrides into analysis startup", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/editor/editor-layout.tsx"),
      "utf8",
    );

    expect(source).toContain("buildAnalysisRuntimeOverrides");
    expect(source).toContain("useAgentSettingsStore.getState()");
    expect(source).toContain(
      "analysisClient.startAnalysis(topic, provider, model, runtime)",
    );
  });

  it("keeps the editor route and landing page analysis-focused", () => {
    const landingLocaleSource = readFileSync(englishLocalePath, "utf8");
    const landingSource = readFileSync(landingPath, "utf8");
    const editorRouteSource = readFileSync(editorRoutePath, "utf8");

    expect(landingSource).toContain('t("landing.title")');
    expect(landingSource).toContain('t("landing.openAnalysis")');
    expect(landingLocaleSource).toContain('"landing.titleAccent": "Analysis"');
    expect(landingLocaleSource).toContain(
      '"landing.openAnalysis": "Open Analysis"',
    );
    expect(landingLocaleSource).toContain(
      '"landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis"',
    );
    expect(editorRouteSource).toContain("Game Theory Analysis");
    expect(editorRouteSource).not.toContain("Workspace");
    expect(editorRouteSource).not.toContain("useKeyboardShortcuts");
  });

  it("wires new/open actions through top bar callbacks in source", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("topbar.newAnalysis");
    expect(source).toContain("onNewAnalysis");
    expect(source).toContain("onOpenAnalysis");
    expect(source).toContain("topbar.save");
    expect(source).not.toContain("useDocumentStore");
  });

  it("aborts the active run, waits for completion, and flushes logs", async () => {
    const controller = new AbortController();
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      capture: vi.fn(),
      flush: vi.fn().mockResolvedValue(true),
      entries: () => [],
    };
    const onSettled = vi.fn();

    const promise = new Promise<AnalysisResult>((resolve) => {
      controller.signal.addEventListener("abort", () => {
        onSettled();
        resolve({
          runId: "run-abort",
          entities: [],
          relationships: [],
        });
      });
    });

    await abortAnalysisRun(
      {
        controller,
        promise,
        runId: "run-abort",
        logger,
      },
      "new-analysis",
    );

    expect(controller.signal.aborted).toBe(true);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith("ui", "abort-requested", {
      reason: "new-analysis",
    });
    expect(logger.flush).toHaveBeenCalledTimes(1);
  });
});
