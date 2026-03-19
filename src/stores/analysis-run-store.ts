import { create } from "zustand";
import type { MethodologyPhase } from "@/types/methodology";
import type { AnalysisFailureKind } from "@/services/ai/methodology-orchestrator";

interface AnalysisRunState {
  runId: string | null;
  status: "idle" | "running" | "failed" | "aborted" | "success";
  activePhase: MethodologyPhase | null;
  attempt: number;
  maxAttempts: number;
  failureKind: AnalysisFailureKind | null;
  lastError: string | null;

  // Actions
  startRun: (runId: string, maxAttempts: number) => void;
  setPhase: (phase: MethodologyPhase) => void;
  setAttempt: (attempt: number) => void;
  failRun: (
    phase: MethodologyPhase,
    kind: AnalysisFailureKind,
    error: string,
  ) => void;
  abortRun: () => void;
  completeRun: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  runId: null,
  status: "idle" as const,
  activePhase: null,
  attempt: 0,
  maxAttempts: 3,
  failureKind: null,
  lastError: null,
};

export const useAnalysisRunStore = create<AnalysisRunState>((set) => ({
  ...INITIAL_STATE,

  startRun: (runId, maxAttempts) =>
    set({
      ...INITIAL_STATE,
      runId,
      status: "running",
      maxAttempts,
    }),

  setPhase: (phase) => set({ activePhase: phase, attempt: 0 }),

  setAttempt: (attempt) => set({ attempt }),

  failRun: (phase, kind, error) =>
    set({
      status: "failed",
      activePhase: phase,
      failureKind: kind,
      lastError: error,
    }),

  abortRun: () => set({ status: "aborted" }),

  completeRun: () => set({ status: "success" }),

  reset: () => set(INITIAL_STATE),
}));
