import { create } from "zustand";
import type { TFunction } from "i18next";
import type { RunFailureKind, RunStatus } from "@/types/api";
import { V3_PHASES } from "@/types/methodology";

export type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "RECOVERING"
  | "DISCONNECTED";

interface RunStatusStoreState {
  runStatus: RunStatus;
  phaseActivityText: string | null;
  connectionState: ConnectionState;
  setRunStatus: (runStatus: RunStatus) => void;
  applySnapshot: (runStatus: RunStatus) => void;
  setPhaseActivityText: (text: string | null) => void;
  clearPhaseActivityText: () => void;
  setConnectionState: (connectionState: ConnectionState) => void;
  resetForTest: () => void;
}

function createInitialRunStatus(): RunStatus {
  return {
    status: "idle",
    kind: null,
    runId: null,
    activePhase: null,
    progress: {
      completed: 0,
      total: V3_PHASES.length,
    },
    deferredRevalidationPending: false,
  };
}

function createInitialState(): Pick<
  RunStatusStoreState,
  "runStatus" | "phaseActivityText" | "connectionState"
> {
  return {
    runStatus: createInitialRunStatus(),
    phaseActivityText: null,
    connectionState: "DISCONNECTED",
  };
}

export const useRunStatusStore = create<RunStatusStoreState>((set) => ({
  ...createInitialState(),

  setRunStatus: (runStatus) => set({ runStatus }),

  applySnapshot: (runStatus) =>
    set({
      runStatus,
      phaseActivityText: null,
    }),

  setPhaseActivityText: (phaseActivityText) => set({ phaseActivityText }),

  clearPhaseActivityText: () => set({ phaseActivityText: null }),

  setConnectionState: (connectionState) => set({ connectionState }),

  resetForTest: () => set(createInitialState()),
}));

const FAILURE_I18N_KEYS: Record<RunFailureKind, string> = {
  rate_limit: "analysis.failure.rateLimit",
  provider_api_error: "analysis.failure.providerApiError",
  connector_error: "analysis.failure.connectorError",
  mcp_transport_error: "analysis.failure.mcpTransportError",
  validation: "analysis.failure.validation",
  timeout: "analysis.failure.timeout",
  unknown: "analysis.failure.unknown",
};

const FAILURE_DEFAULT_LABELS: Record<RunFailureKind, string> = {
  rate_limit: "rate limited",
  provider_api_error: "provider API error",
  connector_error: "connector error",
  mcp_transport_error: "MCP transport error",
  validation: "validation error",
  timeout: "timeout",
  unknown: "unknown error",
};

export function getRunFailureLabel(
  kind: RunFailureKind,
  t: TFunction,
): string {
  return t(FAILURE_I18N_KEYS[kind], {
    defaultValue: FAILURE_DEFAULT_LABELS[kind],
  });
}
