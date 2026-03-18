import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const editorLayoutPath = fileURLToPath(
  new URL("../editor-layout.tsx", import.meta.url),
);
const topBarPath = fileURLToPath(new URL("../top-bar.tsx", import.meta.url));
const landingPath = fileURLToPath(
  new URL("../../../routes/index.tsx", import.meta.url),
);
const editorRoutePath = fileURLToPath(
  new URL("../../../routes/editor.tsx", import.meta.url),
);
const englishLocalePath = fileURLToPath(
  new URL("../../../i18n/locales/en.ts", import.meta.url),
);

describe("Phase 4 shell assertions", () => {
  it("keeps the editor layout analysis-first with a docked AI rail", () => {
    const source = readFileSync(editorLayoutPath, "utf8");

    expect(source).toContain("Manual Analysis");
    expect(source).toContain("Build a complete two-player analysis manually");
    expect(source).toContain("with the analysis assistant");
    expect(source).toContain("AIChatPanel mode=\"analysis\" presentation=\"docked\"");
    expect(source).toContain(
      "xl:grid-cols-[minmax(0,1fr)_400px]",
    );
    expect(source).toContain("xl:sticky xl:top-6");
    expect(source).toContain("order-2 min-w-0 xl:order-1");
    expect(source).toContain("order-1 rounded-2xl border border-border bg-card p-6 shadow-sm xl:sticky xl:top-6 xl:order-2 xl:h-fit");
    expect(source).not.toContain("without AI");
    expect(source).not.toContain("workspace");
    expect(source).not.toContain("design-tool");
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
    expect(editorRouteSource).toContain("Game Theory Manual Analysis");
    expect(editorRouteSource).not.toContain("Workspace");
  });

  it("shows the Phase 04 file actions in the top bar shell", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("topbar.newAnalysis");
    expect(source).toContain("openAnalysis");
    expect(source).toContain("topbar.save");
    expect(source).not.toContain("Session only");
    expect(source).not.toContain("Start a fresh in-memory analysis");
    expect(source).not.toContain("useDocumentStore");
    expect(source).not.toContain("saveDocumentAs");
    expect(source).not.toContain("openDocumentFS");
    expect(source).not.toContain("writeToFilePath");
  });
});
