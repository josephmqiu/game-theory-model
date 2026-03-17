/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AiChatMinimizedBar, AiChatPanel } from "@/components/panels/ai-chat-panel";
import { aiStore } from "@/stores/ai-store";
import { conversationStore } from "@/stores/conversation-store";
import * as agentSettingsModule from "@/stores/agent-settings-store";
import {
  agentSettingsStore,
} from "@/stores/agent-settings-store";

vi.mock("@/services/app-command-runner", () => ({
  sendChatCommand: vi.fn(),
}));

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
    conversationStore.getState().resetConversation();
    agentSettingsStore.setState({
      hydrated: true,
      connectingProvider: null,
      connectionErrors: {},
      providers: {
        anthropic: {
          type: "anthropic",
          displayName: "Claude Code",
          isConnected: false,
          connectionMethod: null,
          models: [],
          installed: false,
          authenticated: null,
          validated: false,
          statusMessage: null,
          lastCheckedAt: null,
          configPath: null,
        },
        openai: {
          type: "openai",
          displayName: "Codex CLI",
          isConnected: false,
          connectionMethod: null,
          models: [],
          installed: false,
          authenticated: null,
          validated: false,
          statusMessage: null,
          lastCheckedAt: null,
          configPath: null,
        },
        opencode: {
          type: "opencode",
          displayName: "OpenCode",
          isConnected: false,
          connectionMethod: null,
          models: [],
          installed: false,
          authenticated: null,
          validated: false,
          statusMessage: null,
          lastCheckedAt: null,
          configPath: null,
        },
        copilot: {
          type: "copilot",
          displayName: "GitHub Copilot",
          isConnected: false,
          connectionMethod: null,
          models: [],
          installed: false,
          authenticated: null,
          validated: false,
          statusMessage: null,
          lastCheckedAt: null,
          configPath: null,
        },
      },
      mcpIntegrations: [],
      mcpTransportMode: "stdio",
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

  it("hydrates connector settings only once across chat rerenders", () => {
    const hydrateSpy = vi
      .spyOn(agentSettingsModule, "hydrateAgentSettingsStore")
      .mockResolvedValue();

    render(<AiChatPanel />);

    act(() => {
      conversationStore.getState().appendMessage({
        role: "user",
        content: "hello",
      });
    });

    expect(hydrateSpy).toHaveBeenCalledTimes(1);
  });

  it("disables chat when no ready provider is connected", () => {
    render(<AiChatPanel />);

    expect(
      screen.getByText(/Connect and validate a provider in Settings/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
