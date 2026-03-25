import { nanoid } from "nanoid";
import type { RunKind } from "../../../shared/types/api";
import type {
  AnalysisPhaseActivityKind,
  PhaseSummary,
} from "../../../shared/types/events";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import type { RuntimeError } from "../../../shared/types/runtime-error";

export const DOMAIN_EVENT_SCHEMA_VERSION = 1;

export const DOMAIN_EVENT_TYPES = [
  "thread.created",
  "run.created",
  "run.status.changed",
  "phase.started",
  "phase.completed",
  "phase.activity.recorded",
  "run.completed",
  "run.failed",
  "run.cancelled",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export interface ThreadCreatedEventPayload {
  title: string;
  isPrimary: boolean;
}

export interface RunCreatedEventPayload {
  kind: RunKind;
  provider: string | null;
  model: string | null;
  effort: string | null;
  status: "running";
  startedAt: number;
  totalPhases: number;
}

export interface RunStatusChangedEventPayload {
  status: "running" | "completed" | "failed" | "cancelled";
  activePhase: MethodologyPhase | null;
  progress: {
    completed: number;
    total: number;
  };
  failedPhase?: MethodologyPhase;
  failure?: RuntimeError;
  finishedAt?: number | null;
}

export interface PhaseStartedEventPayload {
  phase: MethodologyPhase;
}

export interface PhaseCompletedEventPayload {
  phase: MethodologyPhase;
  summary: PhaseSummary;
}

export interface PhaseActivityRecordedEventPayload {
  phase: MethodologyPhase;
  kind: AnalysisPhaseActivityKind;
  message: string;
  toolName?: string;
  query?: string;
}

export interface RunCompletedEventPayload {
  finishedAt: number;
}

export interface RunFailedEventPayload {
  activePhase: MethodologyPhase | null;
  failedPhase?: MethodologyPhase;
  error: RuntimeError;
  finishedAt: number;
}

export interface RunCancelledEventPayload {
  activePhase: MethodologyPhase | null;
  finishedAt: number;
}

export interface DomainEventPayloadMap {
  "thread.created": ThreadCreatedEventPayload;
  "run.created": RunCreatedEventPayload;
  "run.status.changed": RunStatusChangedEventPayload;
  "phase.started": PhaseStartedEventPayload;
  "phase.completed": PhaseCompletedEventPayload;
  "phase.activity.recorded": PhaseActivityRecordedEventPayload;
  "run.completed": RunCompletedEventPayload;
  "run.failed": RunFailedEventPayload;
  "run.cancelled": RunCancelledEventPayload;
}

export interface DomainEventMetadata {
  workspaceId: string;
  threadId: string;
  runId?: string;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  causedByEventId?: string;
  producer: string;
  occurredAt: number;
  recordedAt: number;
  schemaVersion: number;
}

export type DomainEvent<TType extends DomainEventType = DomainEventType> = {
  id: string;
  sequence: number;
  type: TType;
  payload: DomainEventPayloadMap[TType];
} & DomainEventMetadata;

export type AnyDomainEvent = {
  [K in DomainEventType]: DomainEvent<K>;
}[DomainEventType];

export type DomainEventInput<TType extends DomainEventType = DomainEventType> = {
  id?: string;
  type: TType;
  payload: DomainEventPayloadMap[TType];
  workspaceId?: string;
  threadId?: string;
  runId?: string;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  causedByEventId?: string;
  producer?: string;
  occurredAt?: number;
  schemaVersion?: number;
};

export type AnyDomainEventInput = {
  [K in DomainEventType]: DomainEventInput<K>;
}[DomainEventType];

export interface DomainEventRecord {
  id: string;
  sequence: number;
  workspaceId: string;
  threadId: string;
  runId: string | null;
  eventType: DomainEventType;
  payloadJson: string;
  occurredAt: number;
  recordedAt: number;
  commandId: string | null;
  receiptId: string | null;
  correlationId: string | null;
  causationId: string | null;
  causedByEventId: string | null;
  producer: string;
  schemaVersion: number;
}

export function createDomainEventId(): string {
  return `evt-${nanoid()}`;
}
