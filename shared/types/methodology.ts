export type {
  PhaseEntityLike,
  MethodologyPhase,
  PhaseState,
  PhaseStatus,
} from "../../src/types/methodology";

export {
  V2_PHASES,
  V3_PHASES,
  countCompletedRunnablePhases,
  getRunnablePhaseNumber,
  isRunnablePhase,
  normalizePhaseStates,
  upsertPhaseStatus,
} from "../../src/types/methodology";
