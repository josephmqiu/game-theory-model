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

  it("aborts the active stream when stopStreaming is called", () => {
    const abortController = new AbortController();
    useAIStore.getState().setAbortController(abortController);
    useAIStore.getState().setStreaming(true);

    useAIStore.getState().stopStreaming();

    expect(abortController.signal.aborted).toBe(true);
    expect(useAIStore.getState().isStreaming).toBe(false);
    expect(useAIStore.getState().abortController).toBeNull();
  });

  it("adds and removes pending attachments without affecting other AI state", () => {
    useAIStore.getState().addPendingAttachment({
      id: "attachment-1",
      name: "evidence.png",
      mediaType: "image/png",
      data: "Zm9v",
      size: 3,
    });

    useAIStore.getState().removePendingAttachment("attachment-1");

    expect(useAIStore.getState().pendingAttachments).toEqual([]);
  });
});
