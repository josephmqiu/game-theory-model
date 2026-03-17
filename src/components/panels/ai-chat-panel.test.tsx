/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AiChatMinimizedBar } from "@/components/panels/ai-chat-panel";
import { aiStore } from "@/stores/ai-store";

describe("AI panel", () => {
  beforeEach(() => {
    aiStore.setState({
      provider: {
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
      },
      isStreaming: false,
      streamingPhase: null,
      lastError: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("forwards expand and close actions from minimized mode", () => {
    const onExpand = vi.fn();
    const onClose = vi.fn();

    render(<AiChatMinimizedBar onExpand={onExpand} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /AI Panel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close AI panel" }));

    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows provider and model in the compact title", () => {
    aiStore.getState().setProvider({
      provider: "openai",
      modelId: "gpt-5-mini",
    });

    render(<AiChatMinimizedBar onExpand={vi.fn()} onClose={vi.fn()} />);

    const title = screen.getByRole("button", { name: /AI Panel/ });
    expect(title.textContent).toContain("OpenAI");
    expect(title.textContent).toContain("gpt-5-mini");
  });
});
