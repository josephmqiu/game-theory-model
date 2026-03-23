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
    expect(source).toContain("stopStreaming()");
  });

  it("keeps the docked chat submit path conversation-first", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("handleSend()");
    expect(source).toContain('t("analysis.chatEmptyState")');
    expect(source).toContain('t("analysis.chatInputPlaceholder")');
    expect(source).not.toContain("onStartAnalysis");
    expect(source).not.toContain("EXAMPLE_TOPICS");
    expect(source).not.toContain("handleSendWrapped");
  });

  it("keeps lifecycle announcements for completed, failed, and cancelled runs", () => {
    const source = readFileSync(aiChatPanelPath, "utf8");

    expect(source).toContain("useRunStatusStore.subscribe");
    expect(source).toContain("terminalNoticeKeysRef");
    expect(source).toContain("getAnalysisTerminalNoticeKey");
    expect(source).toContain("buildAnalysisTerminalMessage");
    expect(source).toContain("buildAnalysisCompleteMessage");
    expect(source).toContain('nextStatus.status === "idle"');
    expect(source).toContain('nextStatus.status === "failed"');
    expect(source).toContain('nextStatus.status === "cancelled"');
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
