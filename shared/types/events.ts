import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "./entity";
import type { RunStatus } from "./api";
import type { RuntimeError } from "./runtime-error";
import type { UserInputQuestion } from "./user-input";

export interface PhaseSummary {
  entitiesCreated: number;
  relationshipsCreated: number;
  entitiesUpdated: number;
  durationMs: number;
}

export type AnalysisPhaseActivityKind = "note" | "tool" | "web-search";

export interface PhaseStartedEvent {
  type: "phase_started";
  phase: string;
  runId: string;
}

export interface PhaseActivityEvent {
  type: "phase_activity";
  phase: string;
  runId: string;
  kind: AnalysisPhaseActivityKind;
  message: string;
  toolName?: string;
  query?: string;
}

export interface PhaseCompletedEvent {
  type: "phase_completed";
  phase: string;
  runId: string;
  summary: PhaseSummary;
}

export interface AnalysisCompletedEvent {
  type: "analysis_completed";
  runId: string;
}

export interface AnalysisFailedEvent {
  type: "analysis_failed";
  runId: string;
  error: RuntimeError;
}

export interface SynthesisStartedEvent {
  type: "synthesis_started";
  runId: string;
}

export interface SynthesisCompletedEvent {
  type: "synthesis_completed";
  runId: string;
}

export type AnalysisProgressEvent =
  | PhaseStartedEvent
  | PhaseActivityEvent
  | PhaseCompletedEvent
  | AnalysisCompletedEvent
  | AnalysisFailedEvent
  | SynthesisStartedEvent
  | SynthesisCompletedEvent;

export type AnalysisMutationEvent =
  | { type: "entity_created"; entity: AnalysisEntity }
  | { type: "entity_deleted"; entityId: string }
  | { type: "relationship_created"; relationship: AnalysisRelationship }
  | { type: "relationship_deleted"; relationshipId: string }
  | {
      type: "entity_updated";
      entity: AnalysisEntity;
      previousProvenance: EntityProvenance;
    }
  | { type: "relationship_updated"; relationship: AnalysisRelationship }
  | { type: "stale_marked"; entityIds: string[] }
  | { type: "state_changed" };

export type AnalysisEvent = AnalysisProgressEvent | AnalysisMutationEvent;

export type ChatContentKind = "output" | "reasoning";

export interface ChatTextDeltaEvent {
  type: "text_delta";
  content: string;
  content_kind?: ChatContentKind;
}

export interface ChatToolCallStartEvent {
  type: "tool_call_start";
  toolName: string;
  input: unknown;
}

export interface ChatToolCallResultEvent {
  type: "tool_call_result";
  toolName: string;
  output: unknown;
}

export interface ChatToolCallErrorEvent {
  type: "tool_call_error";
  toolName: string;
  error: string;
}

export interface ChatTurnCompleteEvent {
  type: "turn_complete";
}

export interface ChatErrorEvent {
  type: "error";
  error: RuntimeError;
}

export interface ChatUserInputRequestedEvent {
  type: "user_input_requested";
  questions: UserInputQuestion[];
}

export type ChatEvent =
  | ChatTextDeltaEvent
  | ChatToolCallStartEvent
  | ChatToolCallResultEvent
  | ChatToolCallErrorEvent
  | ChatUserInputRequestedEvent
  | ChatTurnCompleteEvent
  | ChatErrorEvent;

export type AnalysisMutationEnvelope = {
  channel: "mutation";
  revision: number;
} & AnalysisMutationEvent;

export type AnalysisProgressEnvelope = {
  channel: "progress";
  revision: number;
} & AnalysisProgressEvent;

export type AnalysisStatusEnvelope = {
  channel: "status";
  revision: number;
} & RunStatus;

export interface AnalysisPingEnvelope {
  channel: "ping";
  revision: number;
}

export type AnalysisStreamEnvelope =
  | AnalysisMutationEnvelope
  | AnalysisProgressEnvelope
  | AnalysisStatusEnvelope
  | AnalysisPingEnvelope;

const CHAT_EVENT_TYPES = new Set([
  "text_delta",
  "tool_call_start",
  "tool_call_result",
  "tool_call_error",
  "user_input_requested",
  "turn_complete",
  "error",
]);

export function isChatEvent(event: unknown): event is ChatEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    CHAT_EVENT_TYPES.has((event as { type: string }).type)
  );
}

export function isTerminalChatEvent(event: ChatEvent): boolean {
  return event.type === "turn_complete" || event.type === "error";
}
