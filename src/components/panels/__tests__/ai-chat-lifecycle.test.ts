import { describe, expect, it } from "vitest";
import {
  buildAnalysisCompleteMessage,
  buildPhaseStartMessage,
  getAnalysisCompleteMessageId,
  getPhaseStartMessageId,
} from "@/components/panels/ai-chat-lifecycle";

describe("ai-chat lifecycle helpers", () => {
  it("builds run-scoped phase start messages with 1-9 numbering", () => {
    const message = buildPhaseStartMessage("run-123", "historical-game");

    expect(message).toMatchObject({
      id: "phase-run-123-historical-game-start",
      role: "assistant",
      content: "Starting Phase 4: Historical Game...",
    });
  });

  it("builds run-scoped completion messages", () => {
    const message = buildAnalysisCompleteMessage("run-456", 95);

    expect(message).toMatchObject({
      id: "analysis-complete-run-456",
      role: "assistant",
      content:
        "Analysis complete. 95 entities identified across 9 phases. Click any entity on the canvas to inspect.",
    });
  });

  it("uses run ids to keep phase and completion ids unique across runs", () => {
    expect(getPhaseStartMessageId("run-a", "situational-grounding")).not.toBe(
      getPhaseStartMessageId("run-b", "situational-grounding"),
    );
    expect(getAnalysisCompleteMessageId("run-a")).not.toBe(
      getAnalysisCompleteMessageId("run-b"),
    );
  });
});
