import { describe, expect, it } from "vitest";
import {
  appendPhaseActivityLine,
  buildPhaseActivityMessage,
  buildPhaseStartMessage,
  getPhaseStartMessageId,
  PHASE_ACTIVITY_LINE_LIMIT,
} from "@/components/panels/ai-chat-lifecycle";

describe("ai-chat lifecycle helpers", () => {
  it("builds a phase status message with the expected first line", () => {
    const message = buildPhaseStartMessage(
      "run-1",
      "situational-grounding",
    );

    expect(message?.id).toBe(
      getPhaseStartMessageId("run-1", "situational-grounding"),
    );
    expect(message?.content).toContain(
      "Phase 1: Situational Grounding",
    );
    expect(message?.content).toContain("Preparing phase analysis.");
  });

  it("dedupes consecutive activity lines and keeps the newest window", () => {
    let lines: string[] = [];
    lines = appendPhaseActivityLine(lines, "Researching evidence.");
    lines = appendPhaseActivityLine(lines, "Researching evidence.");
    lines = appendPhaseActivityLine(lines, "Using get_entity.");

    expect(lines).toEqual(["Researching evidence.", "Using get_entity."]);

    for (let i = 0; i < PHASE_ACTIVITY_LINE_LIMIT + 2; i++) {
      lines = appendPhaseActivityLine(lines, `Note ${i}`);
    }

    expect(lines).toHaveLength(PHASE_ACTIVITY_LINE_LIMIT);
    expect(lines[0]).toBe("Note 2");
  });

  it("builds a phase transcript message from supplied activity lines", () => {
    const message = buildPhaseActivityMessage(
      "run-1",
      "baseline-model",
      ["Preparing phase analysis.", "Researching evidence."],
      false,
    );

    expect(message?.id).toBe(getPhaseStartMessageId("run-1", "baseline-model"));
    expect(message?.content).toContain("Phase 3: Baseline Model");
    expect(message?.content).toContain("Researching evidence.");
    expect(message?.isStreaming).toBe(false);
  });
});
