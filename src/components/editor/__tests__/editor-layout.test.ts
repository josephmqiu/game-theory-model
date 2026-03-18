// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  });

  it("shows the file actions in the top bar shell", () => {
    const source = readFileSync(topBarPath, "utf8");

    expect(source).toContain("topbar.newAnalysis");
    expect(source).toContain("openEntityAnalysis");
    expect(source).toContain("topbar.save");
    expect(source).not.toContain("Session only");
    expect(source).not.toContain("Start a fresh in-memory analysis");
    expect(source).not.toContain("useDocumentStore");
    expect(source).not.toContain("saveDocumentAs");
    expect(source).not.toContain("openDocumentFS");
    expect(source).not.toContain("writeToFilePath");
  });
});
