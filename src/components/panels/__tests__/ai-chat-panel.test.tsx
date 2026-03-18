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

    expect(source).toContain("const isDocked = presentation === 'docked'")
    expect(source).toContain("const isAnalysisMode = mode === 'analysis'")
    expect(source).not.toContain("allowAttachments")
    expect(source).not.toContain("useCanvasStore")
    expect(source).toContain("function getAnalysisQuickActions")
  })

  it("resets analysis chat state when the active analysis id changes", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("previousAnalysisIdRef")
    expect(source).toContain("clearMessages()")
    expect(source).toContain("stopStreaming()")
  })
})
