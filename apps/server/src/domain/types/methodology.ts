/**
 * Re-export canonical methodology types from @t3tools/contracts.
 *
 * This file exists for backward compatibility so that existing imports
 * from "./methodology" or "../types/methodology" continue to work.
 */
export {
  type MethodologyPhase,
  type PhaseStatus,
  type PhaseState,
  type PhaseEntityLike,
  V1_PHASES,
  V2_PHASES,
  V3_PHASES,
  ALL_PHASES,
  PHASE_LABELS,
  PHASE_NUMBERS,
  isRunnablePhase,
  getRunnablePhaseNumber,
  normalizePhaseStates,
  upsertPhaseStatus,
  countCompletedRunnablePhases,
} from "@t3tools/contracts";
