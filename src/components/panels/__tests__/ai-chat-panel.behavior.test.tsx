// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIChatPanel from "@/components/panels/ai-chat-panel";
import { useAIStore } from "@/stores/ai-store";
import type { ChatMessage } from "@/services/ai/ai-types";

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function message(
  id: string,
  role: ChatMessage["role"],
  content = `${role} ${id}`,
): ChatMessage {
  return {
    id,
    role,
    content,
    timestamp: 1,
  };
}

function renderPanel(messages: ChatMessage[] = []) {
  useAIStore.setState({
    ...useAIStore.getInitialState(),
    messages,
    availableModels: [
      {
        value: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet",
        description: "test",
      },
    ],
    isLoadingModels: false,
  });

  return render(<AIChatPanel mode="analysis" presentation="docked" />);
}

describe("AIChatPanel scroll behavior", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn() },
    });
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    useAIStore.setState(useAIStore.getInitialState(), true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not call scrollIntoView when a message appends while READING", async () => {
    renderPanel([
      message("u1", "user", "Question"),
      message("a1", "assistant", "Answer"),
    ]);

    fireEvent.wheel(screen.getByTestId("chat-transcript"), { deltaY: -40 });

    await act(async () => {
      useAIStore.getState().addMessage(message("a2", "assistant", "New"));
    });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("shows the jump pill with unread count while READING", async () => {
    renderPanel([
      message("u1", "user", "Question"),
      message("a1", "assistant", "Answer"),
    ]);

    fireEvent.wheel(screen.getByTestId("chat-transcript"), { deltaY: -40 });

    await act(async () => {
      useAIStore.getState().addMessage(message("a2", "assistant", "New"));
    });

    expect(await screen.findByText("1 new")).toBeTruthy();
    expect(screen.getByText("New since you scrolled")).toBeTruthy();
  });

  it("announces only response started, response complete, stopped, and error", () => {
    const { container } = renderPanel([message("a1", "assistant", "Ready")]);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    const observed = new Set<string>();
    const remember = () => {
      const text = liveRegion?.textContent ?? "";
      if (text) observed.add(text);
    };

    act(() => useAIStore.setState({ isStreaming: true }));
    remember();
    act(() => useAIStore.setState({ isStreaming: false }));
    remember();

    act(() => useAIStore.setState({ isStreaming: true }));
    act(() =>
      useAIStore.setState({
        messages: [
          message("u1", "user", "Question"),
          {
            ...message("a2", "assistant", "Partial"),
            status: "stopped",
          },
        ],
        isStreaming: false,
      }),
    );
    remember();

    act(() => useAIStore.setState({ isStreaming: true }));
    act(() =>
      useAIStore.setState({
        messages: [
          message("u2", "user", "Question"),
          {
            ...message("a3", "assistant", "**Error:** failed"),
            status: "error",
            error: "failed",
          },
        ],
        isStreaming: false,
      }),
    );
    remember();

    expect(observed).toEqual(
      new Set(["Response started", "Response complete", "Stopped", "Error"]),
    );
  });

  it("renders Load earlier when the transcript has more than 200 messages", () => {
    renderPanel(
      Array.from({ length: 205 }, (_, index) =>
        message(`m${index}`, index % 2 === 0 ? "user" : "assistant"),
      ),
    );

    expect(screen.getByText("Load earlier messages")).toBeTruthy();
  });
});
