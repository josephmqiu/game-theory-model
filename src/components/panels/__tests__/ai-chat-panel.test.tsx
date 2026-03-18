import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const aiChatPanelPath = join(
  process.cwd(),
  "src/components/panels/ai-chat-panel.tsx",
);

describe("AIChatPanel analysis mode", () => {
  it("keeps analysis mode and docked mode logic explicit in source", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain('const isDocked = presentation === "docked"');
    expect(source).toContain("const isAnalysisMode = mode");
    expect(source).not.toContain("allowAttachments");
    expect(source).not.toContain("useCanvasStore");
  });

  it("resets analysis chat state when the active analysis id changes", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("previousAnalysisIdRef");
    expect(source).toContain("clearMessages()");
    expect(source).toContain("stopStreaming()");
  });

  it("supports entity graph orchestrator integration", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("onStartAnalysis");
    expect(source).toContain("useEntityGraphStore");
    expect(source).toContain("EXAMPLE_TOPICS");
    expect(source).toContain("handleSendWrapped");
  });

  it("does not depend on the old analysis store", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).not.toContain("useAnalysisStore");
    expect(source).not.toContain("analysis-workflow");
    expect(source).not.toContain("analysis-normalization");
    expect(source).not.toContain("analysis-insights");
    expect(source).not.toContain("analysis-summary");
  });
});
