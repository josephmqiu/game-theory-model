import { create } from "zustand";
import type {
  AIProviderType,
  AIProviderConfig,
  MCPCliIntegration,
  MCPTransportMode,
  GroupedModel,
} from "@/types/agent-settings";
import { V3_PHASES, type MethodologyPhase } from "@/types/methodology";
import { MCP_DEFAULT_PORT } from "@/constants/app";
import { appStorage } from "@/utils/app-storage";
import { isAllowedProvider } from "@/services/ai/allowed-providers";
import type {
  AnalysisEffortLevel,
  AnalysisRuntimeOverrides,
  LegacyRuntimeEffort,
} from "../../shared/types/analysis-runtime";
import { normalizeRuntimeEffort } from "../../shared/types/analysis-runtime";

const STORAGE_KEY = "game-theory-analyzer-agent-settings";

export type AnalysisPhaseMode = "all" | "custom";

interface PersistedState {
  providers: Record<AIProviderType, AIProviderConfig>;
  mcpIntegrations: MCPCliIntegration[];
  mcpTransportMode: MCPTransportMode;
  mcpHttpPort: number;
  analysisWebSearch?: boolean;
  analysisEffortLevel?: AnalysisEffortLevel;
  analysisPhaseMode: AnalysisPhaseMode;
  analysisCustomPhases: MethodologyPhase[];
}

interface AgentSettingsState extends PersistedState {
  dialogOpen: boolean;
  isHydrated: boolean;
  mcpServerRunning: boolean;
  mcpServerLocalIp: string | null;

  connectProvider: (
    provider: AIProviderType,
    method: AIProviderConfig["connectionMethod"],
    models: GroupedModel[],
  ) => void;
  disconnectProvider: (provider: AIProviderType) => void;
  toggleMCPIntegration: (tool: string) => void;
  setMCPTransport: (mode: MCPTransportMode, port?: number) => void;
  setMcpServerStatus: (running: boolean, localIp?: string | null) => void;
  setAnalysisWebSearch: (value: boolean) => void;
  setAnalysisEffortLevel: (value: AnalysisEffortLevel) => void;
  setAnalysisPhaseMode: (mode: AnalysisPhaseMode) => void;
  toggleAnalysisPhase: (phase: MethodologyPhase) => void;
  setDialogOpen: (open: boolean) => void;
  persist: () => void;
  hydrate: () => void;
}

const DEFAULT_ANALYSIS_PHASE_MODE: AnalysisPhaseMode = "all";
const DEFAULT_ANALYSIS_CUSTOM_PHASES = [...V3_PHASES];

function parseAnalysisEffortLevel(
  value: unknown,
): AnalysisEffortLevel | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return normalizeRuntimeEffort(value as LegacyRuntimeEffort);
}

function isAnalysisPhaseMode(value: unknown): value is AnalysisPhaseMode {
  return value === "all" || value === "custom";
}

function normalizeAnalysisCustomPhases(
  phases?: MethodologyPhase[],
): MethodologyPhase[] {
  if (!Array.isArray(phases)) {
    return [...DEFAULT_ANALYSIS_CUSTOM_PHASES];
  }

  const selected = new Set(
    phases.filter((phase): phase is MethodologyPhase =>
      V3_PHASES.includes(phase as MethodologyPhase),
    ),
  );
  const normalized = V3_PHASES.filter((phase) => selected.has(phase));

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_ANALYSIS_CUSTOM_PHASES];
}

function normalizeStoredProviderKey(value: string): AIProviderType | undefined {
  if (value === "claude" || value === "anthropic") {
    return "claude";
  }
  if (value === "codex" || value === "openai") {
    return "codex";
  }
  return undefined;
}

type AnalysisRuntimePreferenceState = Pick<
  PersistedState,
  | "analysisWebSearch"
  | "analysisEffortLevel"
  | "analysisPhaseMode"
  | "analysisCustomPhases"
>;

export function buildAnalysisRuntimeOverrides(
  state: AnalysisRuntimePreferenceState,
): AnalysisRuntimeOverrides | undefined {
  const runtime: AnalysisRuntimeOverrides = {};

  if (typeof state.analysisWebSearch === "boolean") {
    runtime.webSearch = state.analysisWebSearch;
  }

  if (state.analysisEffortLevel) {
    runtime.effortLevel = state.analysisEffortLevel;
  }

  if (state.analysisPhaseMode === "custom") {
    runtime.activePhases = normalizeAnalysisCustomPhases(
      state.analysisCustomPhases,
    );
  }

  return Object.keys(runtime).length > 0 ? runtime : undefined;
}

const DEFAULT_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  claude: {
    type: "claude",
    displayName: "Claude Code",
    isConnected: false,
    connectionMethod: null,
    models: [],
  },
  codex: {
    type: "codex",
    displayName: "Codex CLI",
    isConnected: false,
    connectionMethod: null,
    models: [],
  },
};

const DEFAULT_MCP_INTEGRATIONS: MCPCliIntegration[] = [
  {
    tool: "claude-code",
    displayName: "Claude Code CLI",
    enabled: false,
    installed: false,
  },
  {
    tool: "codex-cli",
    displayName: "Codex CLI",
    enabled: false,
    installed: false,
  },
  {
    tool: "gemini-cli",
    displayName: "Gemini CLI",
    enabled: false,
    installed: false,
  },
  {
    tool: "kiro-cli",
    displayName: "Kiro CLI",
    enabled: false,
    installed: false,
  },
];

export const useAgentSettingsStore = create<AgentSettingsState>((set, get) => ({
  providers: { ...DEFAULT_PROVIDERS },
  mcpIntegrations: [...DEFAULT_MCP_INTEGRATIONS],
  mcpTransportMode: "stdio",
  mcpHttpPort: MCP_DEFAULT_PORT,
  analysisWebSearch: undefined,
  analysisEffortLevel: undefined,
  analysisPhaseMode: DEFAULT_ANALYSIS_PHASE_MODE,
  analysisCustomPhases: [...DEFAULT_ANALYSIS_CUSTOM_PHASES],
  dialogOpen: false,
  isHydrated: false,
  mcpServerRunning: false,
  mcpServerLocalIp: null,

  connectProvider: (provider, method, models) => {
    if (!isAllowedProvider(provider)) return;
    set((s) => ({
      providers: {
        ...s.providers,
        [provider]: {
          ...s.providers[provider],
          isConnected: true,
          connectionMethod: method,
          models,
        },
      },
    }));
  },

  disconnectProvider: (provider) =>
    set((s) => ({
      providers: {
        ...s.providers,
        [provider]: {
          ...DEFAULT_PROVIDERS[provider],
        },
      },
    })),

  toggleMCPIntegration: (tool) =>
    set((s) => ({
      mcpIntegrations: s.mcpIntegrations.map((m) =>
        m.tool === tool ? { ...m, enabled: !m.enabled } : m,
      ),
    })),

  setMCPTransport: (mode, port) =>
    set({
      mcpTransportMode: mode,
      ...(port != null && { mcpHttpPort: port }),
    }),

  setMcpServerStatus: (running, localIp) =>
    set({ mcpServerRunning: running, mcpServerLocalIp: localIp ?? null }),

  setAnalysisWebSearch: (analysisWebSearch) => set({ analysisWebSearch }),

  setAnalysisEffortLevel: (analysisEffortLevel) => set({ analysisEffortLevel }),

  setAnalysisPhaseMode: (analysisPhaseMode) =>
    set((state) => ({
      analysisPhaseMode,
      analysisCustomPhases:
        analysisPhaseMode === "custom"
          ? normalizeAnalysisCustomPhases(state.analysisCustomPhases)
          : state.analysisCustomPhases,
    })),

  toggleAnalysisPhase: (phase) =>
    set((state) => {
      if (!V3_PHASES.includes(phase)) {
        return state;
      }

      const current = normalizeAnalysisCustomPhases(state.analysisCustomPhases);
      const isSelected = current.includes(phase);

      if (isSelected) {
        if (current.length === 1) {
          return state;
        }

        return {
          analysisCustomPhases: current.filter(
            (selectedPhase) => selectedPhase !== phase,
          ),
        };
      }

      return {
        analysisCustomPhases: normalizeAnalysisCustomPhases([
          ...current,
          phase,
        ]),
      };
    }),

  setDialogOpen: (dialogOpen) => set({ dialogOpen }),

  persist: () => {
    try {
      const {
        providers,
        mcpIntegrations,
        mcpTransportMode,
        mcpHttpPort,
        analysisWebSearch,
        analysisEffortLevel,
        analysisPhaseMode,
        analysisCustomPhases,
      } = get();
      appStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          providers,
          mcpIntegrations,
          mcpTransportMode,
          mcpHttpPort,
          analysisWebSearch,
          analysisEffortLevel,
          analysisPhaseMode,
          analysisCustomPhases:
            normalizeAnalysisCustomPhases(analysisCustomPhases),
        }),
      );
    } catch {
      // ignore
    }
  },

  hydrate: () => {
    try {
      const raw = appStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<PersistedState>;
      if (data.providers) {
        const merged = { ...DEFAULT_PROVIDERS };
        for (const [storedKey, storedProvider] of Object.entries(
          data.providers,
        )) {
          const canonicalKey = normalizeStoredProviderKey(storedKey);
          if (!canonicalKey || !storedProvider) {
            continue;
          }
          merged[canonicalKey] = {
            ...merged[canonicalKey],
            ...storedProvider,
            type: canonicalKey,
            models: Array.isArray(storedProvider.models)
              ? storedProvider.models.map((model) => ({
                  ...model,
                  provider: normalizeStoredProviderKey(model.provider) ?? model.provider,
                }))
              : [],
          };
        }
        set({ providers: merged });
      }
      if (data.mcpIntegrations) {
        const mergedMcp = DEFAULT_MCP_INTEGRATIONS.map((def) => {
          const saved = data.mcpIntegrations!.find((m) => m.tool === def.tool);
          return saved ? { ...def, ...saved } : def;
        });
        set({ mcpIntegrations: mergedMcp });
      }
      if (data.mcpTransportMode)
        set({ mcpTransportMode: data.mcpTransportMode });
      if (data.mcpHttpPort) set({ mcpHttpPort: data.mcpHttpPort });
      const analysisPhaseMode = isAnalysisPhaseMode(data.analysisPhaseMode)
        ? data.analysisPhaseMode
        : DEFAULT_ANALYSIS_PHASE_MODE;
      set({
        analysisWebSearch:
          typeof data.analysisWebSearch === "boolean"
            ? data.analysisWebSearch
            : undefined,
        analysisEffortLevel: parseAnalysisEffortLevel(data.analysisEffortLevel),
        analysisPhaseMode,
        analysisCustomPhases: normalizeAnalysisCustomPhases(
          data.analysisCustomPhases,
        ),
      });
    } catch {
      // ignore
    } finally {
      set({ isHydrated: true });
    }
  },
}));
