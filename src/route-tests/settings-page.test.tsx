/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Suspense } from "react";
import { SettingsPage } from "@/routes/settings";
import { renderWithShell } from "@/test-support/render-router";
import type {
  AIProviderType,
  MCPCliTool,
  ProviderStatusSnapshot,
} from "@/types/agent-settings";

const callbacks = vi.hoisted(() => ({
  syncProviderStatuses: vi.fn(),
  syncIntegrationStatuses: vi.fn(),
  setConnectingProvider: vi.fn(),
  setConnectionError: vi.fn(),
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn(),
  setMcpTransportMode: vi.fn(),
  toggleMcpIntegration: vi.fn(),
  setProvider: vi.fn(),
  setAiPanelOpen: vi.fn(),
  setManualMode: vi.fn(),
  toggleInspector: vi.fn(),
  hydrateUiStore: vi.fn(async () => undefined),
  hydrateAgentSettingsStore: vi.fn(async () => undefined),
  setStreaming: vi.fn(),
  setError: vi.fn(),
}));

interface ProviderState {
  provider: AIProviderType;
  installed: boolean;
  authenticated: boolean | null;
  validated: boolean;
  statusMessage: string | null;
  lastCheckedAt: string | null;
  isConnected: boolean;
  connectionMethod: string | null;
  models: Array<{ value: string; displayName: string }>;
  configPath: string | null;
}

const initialUiState = {
  aiPanelOpen: false,
  aiPanelMinimized: false,
  inspectorOpen: true,
  manualMode: true,
};

const initialIntegrationStates: Array<{
  tool: MCPCliTool;
  displayName: string;
  enabled: boolean;
  installed: boolean;
  validated: boolean;
  authenticated: boolean | null;
  configPath: string | null;
}> = [
  {
    tool: "claude-code",
    displayName: "Claude Code CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
  {
    tool: "codex-cli",
    displayName: "Codex CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
  {
    tool: "gemini-cli",
    displayName: "Gemini CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
  {
    tool: "opencode-cli",
    displayName: "OpenCode CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
  {
    tool: "kiro-cli",
    displayName: "Kiro CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
  {
    tool: "copilot-cli",
    displayName: "GitHub Copilot CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    configPath: null,
  },
];

const initialProviderState: Record<AIProviderType, ProviderState> = {
  anthropic: {
    provider: "anthropic",
    installed: false,
    authenticated: null,
    validated: false,
    statusMessage: null,
    lastCheckedAt: "2026-03-14T00:00:00Z",
    isConnected: false,
    connectionMethod: null,
    models: [],
    configPath: null,
  },
  openai: {
    provider: "openai",
    installed: false,
    authenticated: null,
    validated: false,
    statusMessage: null,
    lastCheckedAt: "2026-03-14T00:00:00Z",
    isConnected: false,
    connectionMethod: null,
    models: [],
    configPath: null,
  },
  opencode: {
    provider: "opencode",
    installed: false,
    authenticated: null,
    validated: false,
    statusMessage: null,
    lastCheckedAt: "2026-03-14T00:00:00Z",
    isConnected: false,
    connectionMethod: null,
    models: [],
    configPath: null,
  },
  copilot: {
    provider: "copilot",
    installed: false,
    authenticated: null,
    validated: false,
    statusMessage: null,
    lastCheckedAt: "2026-03-14T00:00:00Z",
    isConnected: false,
    connectionMethod: null,
    models: [],
    configPath: null,
  },
};

let uiState = structuredClone(initialUiState);
let providers = structuredClone(initialProviderState);
let integrations = structuredClone(initialIntegrationStates);

type MockUiState = typeof initialUiState & {
  setAiPanelOpen: (open: boolean) => void;
  setManualMode: (manualMode: boolean) => void;
  toggleInspector: () => void;
};

function resetTestState(): void {
  uiState = structuredClone(initialUiState);
  providers = structuredClone(initialProviderState);
  integrations = structuredClone(initialIntegrationStates);

  callbacks.syncProviderStatuses.mockReset();
  callbacks.syncIntegrationStatuses.mockReset();
  callbacks.setConnectingProvider.mockReset();
  callbacks.setConnectionError.mockReset();
  callbacks.connectProvider.mockReset();
  callbacks.disconnectProvider.mockReset();
  callbacks.setMcpTransportMode.mockReset();
  callbacks.toggleMcpIntegration.mockReset();
  callbacks.setAiPanelOpen.mockReset();
  callbacks.setManualMode.mockReset();
  callbacks.toggleInspector.mockReset();
  callbacks.hydrateUiStore.mockClear();
  callbacks.hydrateAgentSettingsStore.mockClear();
  callbacks.setProvider.mockReset();
  callbacks.setStreaming.mockReset();
  callbacks.setError.mockReset();
}

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeProviderStatusSnapshots(): ProviderStatusSnapshot[] {
  return (Object.values(providers) as ProviderState[]).map((provider) => ({
    provider: provider.provider,
    installed: provider.installed,
    authenticated: provider.authenticated,
    validated: provider.validated,
    statusMessage: provider.statusMessage,
    lastCheckedAt: provider.lastCheckedAt ?? "",
    configPath: provider.configPath,
  }));
}

function getIntegration(tool: MCPCliTool) {
  return integrations.find((entry) => entry.tool === tool);
}

function createIntegrationSnapshot(tool: MCPCliTool) {
  const integration = getIntegration(tool);
  return {
    tool,
    installed: integration?.installed ?? false,
    authenticated: integration?.authenticated ?? null,
    validated: integration?.validated ?? false,
    statusMessage: "ok",
    lastCheckedAt: "2026-03-14T00:00:00Z",
    configPath: integration?.configPath ?? null,
    enabled: integration?.enabled ?? false,
    displayName: integration?.displayName,
  };
}

function getJsonBody(init?: RequestInit): unknown {
  return init?.body ? JSON.parse(init.body as string) : {};
}

function integrationSection(label: string): HTMLElement {
  const heading = screen.getByText(label, { exact: true });
  const container = heading.closest("div.rounded-lg") as HTMLElement | null;
  if (!container) {
    throw new Error(`Expected section for integration label ${label}`);
  }
  return container;
}

vi.mock("@/stores/ui-store", () => ({
  useUiStore: (selector: (state: MockUiState) => unknown) =>
    selector({
      ...uiState,
      setAiPanelOpen: (open: boolean) => {
        uiState = { ...uiState, aiPanelOpen: open };
        callbacks.setAiPanelOpen(open);
      },
      setManualMode: (manualMode: boolean) => {
        uiState = { ...uiState, manualMode };
        callbacks.setManualMode(manualMode);
      },
      toggleInspector: () => {
        uiState = { ...uiState, inspectorOpen: !uiState.inspectorOpen };
        callbacks.toggleInspector();
      },
    }),
  hydrateUiStore: callbacks.hydrateUiStore,
}));

vi.mock("@/stores/agent-settings-store", () => ({
  useAgentSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      providers,
      connectingProvider: null,
      connectionErrors: {},
      mcpIntegrations: integrations,
      mcpTransportMode: "stdio",
      syncProviderStatuses: callbacks.syncProviderStatuses,
      syncIntegrationStatuses: callbacks.syncIntegrationStatuses,
      setConnectingProvider: callbacks.setConnectingProvider,
      setConnectionError: callbacks.setConnectionError,
      connectProvider: callbacks.connectProvider,
      disconnectProvider: callbacks.disconnectProvider,
      setMcpTransportMode: callbacks.setMcpTransportMode,
      toggleMcpIntegration: callbacks.toggleMcpIntegration,
    }),
  hydrateAgentSettingsStore: callbacks.hydrateAgentSettingsStore,
  agentSettingsStore: {
    getState: () => ({
      syncProviderStatuses: callbacks.syncProviderStatuses,
      syncIntegrationStatuses: callbacks.syncIntegrationStatuses,
      setConnectingProvider: callbacks.setConnectingProvider,
      setConnectionError: callbacks.setConnectionError,
      connectProvider: callbacks.connectProvider,
      disconnectProvider: callbacks.disconnectProvider,
      setMcpTransportMode: callbacks.setMcpTransportMode,
      toggleMcpIntegration: callbacks.toggleMcpIntegration,
    }),
  },
}));

vi.mock("@/stores/ai-store", () => ({
  aiStore: {
    getState: () => ({
      setProvider: callbacks.setProvider,
      setStreaming: callbacks.setStreaming,
      setError: callbacks.setError,
    }),
  },
  useAiStore: (
    selector: (state: { provider: { provider: string; modelId: string } }) => unknown,
  ) =>
    selector({
      provider: {
        provider: "anthropic",
        modelId: "claude-3-5-sonnet-20240620",
      },
    }),
}));

describe("Settings route", () => {
  const renderedShells: Array<ReturnType<typeof renderWithShell>> = [];

  beforeEach(() => {
    resetTestState();

    vi.spyOn(global, "fetch").mockImplementation((request, init) => {
      const target = request.toString();

      if (target.includes("/api/integrations/status")) {
        return Promise.resolve(
          createJsonResponse({
            providers: makeProviderStatusSnapshots(),
            integrations: integrations.map((integration) =>
              createIntegrationSnapshot(integration.tool),
            ),
          }),
        );
      }

      if (target.includes("/api/integrations/validate")) {
        const payload = getJsonBody(init);
        if (typeof payload === "object" && payload !== null && "kind" in payload) {
          const kind = (payload as { kind: string }).kind;
          if (kind === "provider") {
            const provider = (payload as unknown as { target: AIProviderType }).target;
            return Promise.resolve(
              createJsonResponse({
                provider: {
                  provider,
                  installed: true,
                  authenticated: true,
                  validated: true,
                  statusMessage: "validated",
                  lastCheckedAt: "2026-03-14T00:00:00Z",
                  configPath: null,
                },
                models: [],
              }),
            );
          }

          const integration = (payload as unknown as { target: MCPCliTool }).target;
          return Promise.resolve(
            createJsonResponse({ integration: createIntegrationSnapshot(integration) }),
          );
        }

        return Promise.resolve(createJsonResponse({ error: "bad payload" }));
      }

      if (target.includes("/api/mcp/config") && init?.method === "POST") {
        const payload = getJsonBody(init);
        const tool = (payload as { tool: MCPCliTool }).tool;
        const integration = getIntegration(tool);
        if (integration) {
          integration.configPath = "/tmp/config.json";
        }
        return Promise.resolve(
          createJsonResponse({ integration: createIntegrationSnapshot(tool) }),
        );
      }

      if (target.includes("/api/mcp/config") && init?.method === "DELETE") {
        const payload = getJsonBody(init);
        const tool = (payload as { tool: MCPCliTool }).tool;
        const integration = getIntegration(tool);
        if (integration) {
          integration.configPath = null;
        }
        return Promise.resolve(createJsonResponse({ integration: null }));
      }

      return Promise.resolve(createJsonResponse({}));
    });
  });

  afterEach(() => {
    while (renderedShells.length > 0) {
      renderedShells.pop()?.unmount();
    }
    vi.restoreAllMocks();
  });

  it("refreshes statuses and applies shell preference toggles", async () => {
    renderedShells.push(renderWithShell(
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>,
    ));

    await waitFor(() => {
      expect(callbacks.hydrateAgentSettingsStore).toHaveBeenCalledTimes(1);
      expect(callbacks.syncProviderStatuses).toHaveBeenCalledTimes(1);
      expect(callbacks.syncIntegrationStatuses).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Open AI panel" }));
    expect(callbacks.setAiPanelOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Hide inspector" }));
    expect(callbacks.toggleInspector).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Disable manual mode/i }));
    expect(callbacks.setManualMode).toHaveBeenCalledWith(false);

    const refreshCalls = callbacks.syncProviderStatuses.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => {
      expect(callbacks.syncProviderStatuses).toHaveBeenCalledTimes(refreshCalls + 1);
    });
  });

  it("validates integration, writes MCP config, and removes MCP config", async () => {
    const claude = getIntegration("claude-code");
    if (!claude) throw new Error("Expected claude integration fixture");
    claude.installed = true;
    claude.validated = true;
    claude.authenticated = true;
    claude.configPath = "/tmp/claude-config.json";

    renderedShells.push(renderWithShell(
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>,
    ));

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeTruthy();
    });

    const claudeSection = integrationSection("Claude Code CLI");

    fireEvent.click(within(claudeSection).getByRole("button", { name: "Validate" }));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/integrations/validate"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(within(claudeSection).getByRole("button", { name: "Write config" }));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/config"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tool":"claude-code"'),
        }),
      );
    });

    fireEvent.click(within(claudeSection).getByRole("button", { name: "Remove config" }));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/config"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
