import { create } from "zustand";
import type { TFunction } from "i18next";
import type { RunStatus } from "../../shared/types/api";
import type {
  RuntimeError,
  RuntimeErrorTag,
} from "../../shared/types/runtime-error";
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

const FAILURE_I18N_KEYS: Record<RuntimeErrorTag, string> = {
  validation: "analysis.failure.validation",
  transport: "analysis.failure.timeout",
  provider: "analysis.failure.providerApiError",
  session: "analysis.failure.connectorError",
  process: "analysis.failure.connectorError",
};

const FAILURE_DEFAULT_LABELS: Record<RuntimeErrorTag, string> = {
  validation: "validation error",
  transport: "transport error",
  provider: "provider error",
  session: "session error",
  process: "process error",
};

export function getRunFailureLabel(
  failure: RuntimeError,
  t: TFunction,
): string {
  return t(FAILURE_I18N_KEYS[failure.tag], {
    defaultValue: FAILURE_DEFAULT_LABELS[failure.tag],
  });
}
