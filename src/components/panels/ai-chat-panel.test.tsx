/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AiChatMinimizedBar } from "@/components/panels/ai-chat-panel";
import { aiStore } from "@/stores/ai-store";
import { conversationStore } from "@/stores/conversation-store";
import { agentSettingsStore } from "@/stores/agent-settings-store";

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
          statusStage: "missing_binary",
          reachable: null,
          lastError: null,
          modelsDiscovered: 0,
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
          statusStage: "missing_binary",
          reachable: null,
          lastError: null,
          modelsDiscovered: 0,
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
          statusStage: "missing_binary",
          reachable: null,
          lastError: null,
          modelsDiscovered: 0,
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
          statusStage: "missing_binary",
          reachable: null,
          lastError: null,
          modelsDiscovered: 0,
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

  it("reports no ready provider when all connectors are disconnected", () => {
    const state = agentSettingsStore.getState();
    const readyProviders = (
      Object.keys(state.providers) as Array<keyof typeof state.providers>
    ).filter((key) => {
      const config = state.providers[key];
      return config.isConnected && config.validated;
    });

    expect(readyProviders).toHaveLength(0);
  });

  it("tracks conversation messages through the store", () => {
    conversationStore.getState().appendMessage({
      role: "user",
      content: "hello",
    });
    conversationStore.getState().appendMessage({
      role: "ai",
      content: "hi there",
    });

    const { messages } = conversationStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("ai");
  });
});
