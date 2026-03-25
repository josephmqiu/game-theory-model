import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAIStore } from "@/stores/ai-store";

describe("ai-store", () => {
  beforeEach(() => {
    useAIStore.setState(useAIStore.getInitialState(), true);
  });

  afterEach(() => {
    useAIStore.setState(useAIStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it("does not append duplicate messages with the same id", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const message = {
      id: "phase-situational-grounding-start",
      role: "assistant" as const,
      content: "Starting Phase 1: Situational Grounding...",
      timestamp: 1,
    };

    useAIStore.getState().addMessage(message);
    useAIStore.getState().addMessage({ ...message, timestamp: 2 });

    expect(useAIStore.getState().messages).toEqual([message]);
    expect(warnSpy).toHaveBeenCalledWith("[ai-store] duplicate message id", {
      id: "phase-situational-grounding-start",
    });
  });

  it("updates a message by id without changing message order", () => {
    const message = {
      id: "phase-situational-grounding-start",
      role: "assistant" as const,
      content: "Phase 1: Situational Grounding\nPreparing phase analysis.",
      timestamp: 1,
      isStreaming: true,
    };

    useAIStore.getState().addMessage(message);
    useAIStore.getState().updateMessageById(message.id, {
      content:
        "Phase 1: Situational Grounding\nPreparing phase analysis.\nResearching evidence.",
      isStreaming: false,
    });

    expect(useAIStore.getState().messages).toEqual([
      {
        ...message,
        content:
          "Phase 1: Situational Grounding\nPreparing phase analysis.\nResearching evidence.",
        isStreaming: false,
      },
    ]);
  });
});
