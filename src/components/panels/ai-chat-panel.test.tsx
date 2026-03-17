/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { AiChatPanel } from "@/components/panels/ai-chat-panel";
import { conversationStore } from "@/stores/conversation-store";
import { renderWithShell } from "@/test-support/render-router";
import type { AgentChatMessage } from "@/stores/ai-store";

// ---- mock state buckets (updated by helpers below) ----

const mockAiState = vi.hoisted(() => ({
  provider: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  isStreaming: false,
  lastError: null as string | null,
  agentMessages: [] as AgentChatMessage[],
  stopStreaming: vi.fn(),
  setProvider: vi.fn(),
}));

const mockSettingsState = vi.hoisted(() => ({
  hydrated: true,
  providers: {
    anthropic: {
      type: "anthropic",
      displayName: "Claude Code",
      isConnected: false,
      models: [],
      validated: false,
    },
    openai: {
      type: "openai",
      displayName: "Codex CLI",
      isConnected: false,
      models: [],
      validated: false,
    },
    opencode: {
      type: "opencode",
      displayName: "OpenCode",
      isConnected: false,
      models: [],
      validated: false,
    },
    copilot: {
      type: "copilot",
      displayName: "GitHub Copilot",
      isConnected: false,
      models: [],
      validated: false,
    },
  },
}));

vi.mock("@/stores/ai-store", () => ({
  useAiStore: (selector: (s: typeof mockAiState) => unknown) =>
    selector(mockAiState),
  aiStore: {
    getState: () => mockAiState,
  },
}));

vi.mock("@/stores/agent-settings-store", () => ({
  useAgentSettingsStore: (selector: (s: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
  agentSettingsStore: {
    getState: () => mockSettingsState,
    setState: vi.fn(),
  },
}));

vi.mock("@/services/agent-chat-handler", () => ({
  sendAgentMessage: vi.fn(),
}));

// ---- helpers ----

function resetMockState() {
  mockAiState.provider = {
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
  };
  mockAiState.isStreaming = false;
  mockAiState.lastError = null;
  mockAiState.agentMessages = [];
  mockAiState.stopStreaming.mockReset();
  mockAiState.setProvider.mockReset();
  vi.clearAllMocks();
}

// ---- tests ----

describe("AI panel", () => {
  beforeEach(resetMockState);

  afterEach(() => {
    cleanup();
  });

  it("reports no ready provider when all connectors are disconnected", () => {
    const { providers } = mockSettingsState;
    const readyProviders = (
      Object.keys(providers) as Array<keyof typeof providers>
    ).filter((key) => providers[key].isConnected && providers[key].validated);

    expect(readyProviders).toHaveLength(0);
  });

  it("tracks conversation messages through the store", () => {
    conversationStore
      .getState()
      .appendMessage({ role: "user", content: "hello" });
    conversationStore
      .getState()
      .appendMessage({ role: "ai", content: "hi there" });

    const { messages } = conversationStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("ai");

    conversationStore.getState().resetConversation();
  });

  it("shows Stop button when streaming", async () => {
    mockAiState.isStreaming = true;
    const shell = renderWithShell(<AiChatPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Stop streaming" }),
      ).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();

    shell.unmount();
  });

  it("shows Send button when not streaming", async () => {
    mockAiState.isStreaming = false;
    const shell = renderWithShell(<AiChatPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Send message" }),
      ).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: "Stop streaming" })).toBeNull();

    shell.unmount();
  });

  it("renders agent messages including tool call entries", async () => {
    mockAiState.agentMessages = [
      {
        id: "msg-1",
        role: "user",
        content: "analyze this",
        thinking: "",
        toolCalls: [],
        isStreaming: false,
        timestamp: new Date().toISOString(),
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Done.",
        thinking: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "add_player",
            input: { name: "Alice" },
            status: "complete",
            result: { ok: true },
            durationMs: 42,
          },
        ],
        isStreaming: false,
        timestamp: new Date().toISOString(),
      },
    ];

    const shell = renderWithShell(<AiChatPanel />);

    await waitFor(() => {
      expect(screen.getByText("analyze this")).toBeDefined();
    });

    // Assistant text content
    expect(screen.getByText("Done.")).toBeDefined();
    // Tool call name rendered in monospace
    expect(screen.getByText("add_player")).toBeDefined();
    // Tool call summary (name field of input)
    expect(screen.getByText("Alice")).toBeDefined();
    // Duration badge
    expect(screen.getByText("42ms")).toBeDefined();

    shell.unmount();
  });
});
