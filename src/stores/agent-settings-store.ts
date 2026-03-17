import { createStore, useStore } from "zustand";
import type {
  AIProviderConfig,
  AIProviderType,
  GroupedModel,
  MCPCliIntegration,
  MCPTransportMode,
  IntegrationStatusSnapshot,
  ProviderStatusSnapshot,
  ProviderConnectionMethod,
} from "@/types/agent-settings";

const STORAGE_KEY = "game-theory.agent-settings";

interface PersistedAgentSettingsState {
  providers: Record<AIProviderType, AIProviderConfig>;
  mcpIntegrations: MCPCliIntegration[];
  mcpTransportMode: MCPTransportMode;
}

interface AgentSettingsState extends PersistedAgentSettingsState {
  hydrated: boolean;
  connectingProvider: AIProviderType | null;
  connectionErrors: Partial<Record<AIProviderType, string | null>>;
}

interface AgentSettingsActions {
  hydrate: (state: Partial<PersistedAgentSettingsState>) => void;
  setConnectingProvider: (provider: AIProviderType | null) => void;
  setConnectionError: (provider: AIProviderType, error: string | null) => void;
  syncProviderStatuses: (statuses: ProviderStatusSnapshot[]) => void;
  syncIntegrationStatuses: (statuses: IntegrationStatusSnapshot[]) => void;
  connectProvider: (
    provider: AIProviderType,
    method: ProviderConnectionMethod,
    models: GroupedModel[],
  ) => void;
  disconnectProvider: (provider: AIProviderType) => void;
  toggleMcpIntegration: (tool: MCPCliIntegration["tool"]) => void;
  setMcpTransportMode: (mode: MCPTransportMode) => void;
}

type AgentSettingsStore = AgentSettingsState & AgentSettingsActions;

const DEFAULT_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
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
    reachable: false,
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
    reachable: false,
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
    reachable: false,
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
    reachable: false,
    lastError: null,
    modelsDiscovered: 0,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
};

const DEFAULT_MCP_INTEGRATIONS: MCPCliIntegration[] = [
  {
    tool: "claude-code",
    displayName: "Claude Code CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
  {
    tool: "codex-cli",
    displayName: "Codex CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
  {
    tool: "gemini-cli",
    displayName: "Gemini CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
  {
    tool: "opencode-cli",
    displayName: "OpenCode CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
  {
    tool: "kiro-cli",
    displayName: "Kiro CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
  {
    tool: "copilot-cli",
    displayName: "GitHub Copilot CLI",
    enabled: false,
    installed: false,
    validated: false,
    authenticated: null,
    statusStage: "missing_binary",
    reachable: false,
    lastError: null,
    statusMessage: null,
    lastCheckedAt: null,
    configPath: null,
  },
];

const initialState: AgentSettingsState = {
  providers: { ...DEFAULT_PROVIDERS },
  mcpIntegrations: [...DEFAULT_MCP_INTEGRATIONS],
  mcpTransportMode: "stdio",
  hydrated: false,
  connectingProvider: null,
  connectionErrors: {},
};

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

function persistAgentSettings(state: PersistedAgentSettingsState): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify(state);
  if (isElectron()) {
    void window.electronAPI!.setPreference(STORAGE_KEY, payload);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // Ignore storage failures.
  }
}

let hydratePromise: Promise<void> | null = null;

export const agentSettingsStore = createStore<AgentSettingsStore>((set) => ({
  ...initialState,

  hydrate(state) {
    const providers = { ...DEFAULT_PROVIDERS };
    for (const key of Object.keys(providers) as AIProviderType[]) {
      if (state.providers?.[key]) {
        providers[key] = { ...providers[key], ...state.providers[key] };
      }
    }

    const mcpIntegrations = DEFAULT_MCP_INTEGRATIONS.map((integration) => {
      const saved = state.mcpIntegrations?.find(
        (item) => item.tool === integration.tool,
      );
      return saved ? { ...integration, ...saved } : integration;
    });

    set({
      providers,
      mcpIntegrations,
      mcpTransportMode: state.mcpTransportMode ?? "stdio",
      hydrated: true,
    });
  },

  setConnectingProvider(provider) {
    set({ connectingProvider: provider });
  },

  setConnectionError(provider, error) {
    set((state) => ({
      connectionErrors: {
        ...state.connectionErrors,
        [provider]: error,
      },
    }));
  },

  syncProviderStatuses(statuses) {
    set((state) => {
      const nextProviders = { ...state.providers };
      for (const status of statuses) {
        const existing = nextProviders[status.provider];
        const shouldResetConnection = !status.installed;
        const preserveConnectedState =
          status.installed &&
          status.statusStage === "detected" &&
          existing.isConnected &&
          existing.models.length > 0;
        nextProviders[status.provider] = {
          ...existing,
          installed: status.installed,
          authenticated: preserveConnectedState
            ? existing.authenticated
            : status.authenticated,
          validated: preserveConnectedState
            ? existing.validated
            : status.validated,
          statusStage: preserveConnectedState
            ? existing.statusStage
            : status.statusStage,
          reachable: preserveConnectedState
            ? existing.reachable
            : status.reachable,
          lastError: preserveConnectedState ? null : status.lastError,
          modelsDiscovered: preserveConnectedState
            ? existing.models.length
            : status.modelsDiscovered ?? 0,
          statusMessage: preserveConnectedState
            ? existing.statusMessage
            : status.statusMessage,
          lastCheckedAt: status.lastCheckedAt,
          configPath: status.configPath,
          ...(shouldResetConnection
            ? {
                isConnected: false,
                connectionMethod: null,
                models: [],
              }
            : {}),
        };
      }

      persistAgentSettings({
        providers: nextProviders,
        mcpIntegrations: state.mcpIntegrations,
        mcpTransportMode: state.mcpTransportMode,
      });

      return { providers: nextProviders };
    });
  },

  syncIntegrationStatuses(statuses) {
    set((state) => {
      const nextIntegrations = state.mcpIntegrations.map((integration) => {
        const status = statuses.find((entry) => entry.tool === integration.tool);
        return status
          ? {
              ...integration,
              enabled:
                integration.enabled &&
                status.installed &&
                status.validated &&
                Boolean(status.configPath),
              installed: status.installed,
              authenticated: status.authenticated,
              validated: status.validated,
              statusStage: status.statusStage,
              reachable: status.reachable,
              lastError: status.lastError,
              statusMessage: status.statusMessage,
              lastCheckedAt: status.lastCheckedAt,
              configPath: status.configPath,
            }
          : integration;
      });

      persistAgentSettings({
        providers: state.providers,
        mcpIntegrations: nextIntegrations,
        mcpTransportMode: state.mcpTransportMode,
      });

      return { mcpIntegrations: nextIntegrations };
    });
  },

  connectProvider(provider, method, models) {
    set((state) => {
      const nextProviders = {
        ...state.providers,
        [provider]: {
          ...state.providers[provider],
          isConnected: true,
          connectionMethod: method,
          models,
          installed: true,
          authenticated: true,
          validated: true,
          statusStage: "ready",
          reachable: true,
          lastError: null,
          modelsDiscovered: models.length,
          statusMessage:
            models.length > 0
              ? `${models.length} models discovered.`
              : "Connected.",
          lastCheckedAt: new Date().toISOString(),
        },
      };

      persistAgentSettings({
        providers: nextProviders,
        mcpIntegrations: state.mcpIntegrations,
        mcpTransportMode: state.mcpTransportMode,
      });

      return {
        providers: nextProviders,
        connectionErrors: { ...state.connectionErrors, [provider]: null },
      };
    });
  },

  disconnectProvider(provider) {
    set((state) => {
      const nextProviders = {
        ...state.providers,
        [provider]: {
          ...state.providers[provider],
          isConnected: false,
          connectionMethod: null,
          models: [],
          modelsDiscovered: 0,
        },
      };

      persistAgentSettings({
        providers: nextProviders,
        mcpIntegrations: state.mcpIntegrations,
        mcpTransportMode: state.mcpTransportMode,
      });

      return {
        providers: nextProviders,
        connectionErrors: { ...state.connectionErrors, [provider]: null },
      };
    });
  },

  toggleMcpIntegration(tool) {
    set((state) => {
      const nextIntegrations = state.mcpIntegrations.map((integration) =>
        integration.tool === tool
          ? {
              ...integration,
              enabled:
                integration.installed &&
                integration.validated &&
                Boolean(integration.configPath)
                  ? !integration.enabled
                  : false,
            }
          : integration,
      );

      persistAgentSettings({
        providers: state.providers,
        mcpIntegrations: nextIntegrations,
        mcpTransportMode: state.mcpTransportMode,
      });

      return { mcpIntegrations: nextIntegrations };
    });
  },

  setMcpTransportMode(mode) {
    set((state) => {
      persistAgentSettings({
        providers: state.providers,
        mcpIntegrations: state.mcpIntegrations,
        mcpTransportMode: mode,
      });

      return { mcpTransportMode: mode };
    });
  },
}));

export function useAgentSettingsStore<T>(
  selector: (state: AgentSettingsStore) => T,
): T {
  return useStore(agentSettingsStore, selector);
}

export async function hydrateAgentSettingsStore(): Promise<void> {
  if (typeof window === "undefined") return;
  if (agentSettingsStore.getState().hydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      let raw: string | null = null;

      if (isElectron()) {
        const prefs = await window.electronAPI!.getPreferences();
        raw = prefs[STORAGE_KEY] ?? null;
      } else {
        raw = window.localStorage.getItem(STORAGE_KEY);
      }

      if (!raw) {
        agentSettingsStore.getState().hydrate({});
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedAgentSettingsState>;
      agentSettingsStore.getState().hydrate(parsed);
    } catch {
      agentSettingsStore.getState().hydrate({});
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}
