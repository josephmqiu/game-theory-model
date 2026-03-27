import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const topBarPath = join(process.cwd(), "src/components/editor/top-bar.tsx");
const landingPath = join(process.cwd(), "src/routes/index.tsx");
const editorRoutePath = join(process.cwd(), "src/routes/editor.tsx");
const englishLocalePath = join(process.cwd(), "src/i18n/locales/en.ts");
const analysisLauncherPath = join(
  process.cwd(),
  "src/components/editor/analysis-launcher.tsx",
);

describe("editor layout", () => {
  it("renders the analysis shell with the docked AI panel in source", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/editor/editor-layout.tsx"),
      "utf8",
    );

    expect(source).toContain("AIChatPanel");
    expect(source).toContain("AnalysisLauncher");
    expect(source).toContain('mode="analysis"');
    expect(source).toContain('presentation="docked"');
    expect(source).toContain(
      '<AIChatPanel mode="analysis" presentation="docked" />',
    );
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
      'provider === "claude" || provider === "codex"',
    );
    expect(source).toContain(
      "analysisClient.startAnalysis(",
    );
    expect(source).toContain(
      "<AnalysisLauncher onStartAnalysis={startOrchestrator} />",
    );
  });

  it("derives entity overlay position from live viewport state", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/editor/editor-layout.tsx"),
      "utf8",
    );

    expect(source).toContain("useCanvasStore");
    expect(source).toContain("sceneToScreen");
    expect(source).toContain("selectedEntityScreenPosition");
    expect(source).not.toContain("setOverlayPosition");
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

  it("shows a centered launcher only for a truly blank analysis", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/editor/editor-layout.tsx"),
      "utf8",
    );
    const launcherSource = readFileSync(analysisLauncherPath, "utf8");

    expect(source).toContain("const showAnalysisLauncher =");
    expect(source).toContain(
      "analysisTopic.trim().length === 0 && entityCount === 0",
    );
    expect(launcherSource).toContain("EXAMPLE_TOPICS");
    expect(launcherSource).toContain('t("ai.noModelsConnected")');
    expect(launcherSource).toContain(
      "onStartAnalysis(topic, currentProvider, validModel)",
    );
  });
});
