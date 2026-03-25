/**
 * Re-export canonical event types from @t3tools/contracts.
 *
 * This file exists for backward compatibility so that existing imports
 * from "./events" or "../types/events" continue to work.
 */
export type {
  PhaseSummary,
  AnalysisPhaseActivityKind,
  AnalysisProgressEvent,
  AnalysisMutationEvent,
  AnalysisEvent,
  ChatEvent,
} from "@t3tools/contracts";
