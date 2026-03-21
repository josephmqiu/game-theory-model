import { describe, expect, it } from "vitest";
import { resolveToolStatus } from "@/components/panels/ai-chat-panel";

describe("ai-chat panel tool status", () => {
  it("uses explicit terminal tool state over message prose", () => {
    expect(
      resolveToolStatus(
        { toolStatus: "done", isStreaming: true },
        true,
      ),
    ).toBe("done");
  });

  it("falls back to streaming state when tool metadata is absent", () => {
    expect(
      resolveToolStatus(
        { toolStatus: undefined, isStreaming: true },
        true,
      ),
    ).toBe("running");
  });
});
