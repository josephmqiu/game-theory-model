import { describe, expect, it } from "vitest";
import {
  buildAnalysisCompleteMessage,
  getAnalysisCompleteMessageId,
} from "@/components/panels/ai-chat-lifecycle";

describe("ai-chat lifecycle helpers", () => {
  it("builds an analysis-complete message with entity count and correct id", () => {
    const message = buildAnalysisCompleteMessage("run-1", 42);

    expect(message.id).toBe(getAnalysisCompleteMessageId("run-1"));
    expect(message.content).toContain("Analysis complete");
    expect(message.content).toContain("42 entities");
    expect(message.role).toBe("assistant");
  });
});
