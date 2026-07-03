export type {
  PhaseEntityLike,
  MethodologyPhase,
  PhaseState,
  PhaseStatus,
} from "../../src/types/methodology";

export {
  RUNNABLE_PHASES,
  countCompletedRunnablePhases,
  getRunnablePhaseNumber,
  isRunnablePhase,
  normalizePhaseStates,
  upsertPhaseStatus,
} from "../../src/types/methodology";
