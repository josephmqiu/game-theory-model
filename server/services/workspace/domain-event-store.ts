import { nanoid } from "nanoid";
import type { DatabaseSync } from "node:sqlite";
import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
  ThreadMessageState,
  ThreadState,
} from "../../../shared/types/workspace-state";
import {
  createDomainEventId,
  DOMAIN_EVENT_SCHEMA_VERSION,
  type AnyDomainEvent,
  type AnyDomainEventInput,
  type DomainEvent,
  type DomainEventInput,
} from "./domain-event-types";
import { stringifyJson } from "./sqlite-json";
import type { ActivityRepository } from "./activity-repository";
import type { DomainEventRepository } from "./domain-event-repository";
import type { PhaseTurnSummaryRepository } from "./phase-turn-summary-repository";
import type { RunRepository } from "./run-repository";
import type { ThreadRepository } from "./thread-repository";
import type { WorkspaceRepository } from "./workspace-repository";
import type { MessageRepository } from "./message-repository";
import {
  PRIMARY_THREAD_TITLE,
  resolveThreadContext,
} from "./workspace-context";

interface DomainProjectorDependencies {
  threads: ThreadRepository;
  messages: MessageRepository;
  runs: RunRepository;
  activities: ActivityRepository;
  phaseTurnSummaries: PhaseTurnSummaryRepository;
}

export interface ResolvedDomainContext {
  workspaceId: string;
  threadId: string;
  threadTitle: string;
  createdThreadEvent?: DomainEventInput<"thread.created">;
}

export interface DomainEventStore {
  appendEvents(events: AnyDomainEventInput[]): DomainEvent[];
  getLastEventByRunId(runId: string): DomainEvent | undefined;
  listEventsByRunId(runId: string): DomainEvent[];
  resolveThreadContext(input: {
    workspaceId?: string;
    threadId?: string;
    threadTitle?: string;
    producer: string;
    commandId?: string;
    receiptId?: string;
    correlationId?: string;
    causationId?: string;
    occurredAt?: number;
  }): ResolvedDomainContext;
}

function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function updateThreadActivity(
  thread: ThreadState,
  occurredAt: number,
): ThreadState {
  return {
    ...thread,
    latestActivityAt:
      thread.latestActivityAt === undefined
        ? occurredAt
        : Math.max(thread.latestActivityAt, occurredAt),
    updatedAt: Math.max(thread.updatedAt, occurredAt),
  };
}

function projectEvent(
  event: AnyDomainEvent,
  repositories: DomainProjectorDependencies,
): void {
  switch (event.type) {
    case "thread.created": {
      const existing = repositories.threads.getThreadState(event.threadId);
      const next: ThreadState = {
        id: event.threadId,
        workspaceId: event.workspaceId,
        title: event.payload.title,
        isPrimary: event.payload.isPrimary,
        createdAt: existing?.createdAt ?? event.occurredAt,
        updatedAt: event.occurredAt,
        latestRunId: existing?.latestRunId,
        latestActivityAt: existing?.latestActivityAt,
        latestTerminalStatus: existing?.latestTerminalStatus,
        summary: existing?.summary,
      };
      repositories.threads.upsertThreadState(next);
      return;
    }
    case "message.recorded": {
      const message: ThreadMessageState = {
        id: event.payload.messageId,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        role: event.payload.role,
        content: event.payload.content,
        attachments: event.payload.attachments,
        createdAt: event.payload.createdAt,
        updatedAt: event.payload.updatedAt,
      };
      repositories.messages.upsertMessage({
        id: message.id,
        workspaceId: message.workspaceId,
        threadId: message.threadId,
        role: message.role,
        content: message.content,
        messageJson: stringifyJson(message),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      });

      const thread = repositories.threads.getThreadState(event.threadId);
      if (thread) {
        repositories.threads.upsertThreadState(
          updateThreadActivity(thread, event.occurredAt),
        );
      }
      return;
    }
    case "run.created": {
      const existingThread = repositories.threads.getThreadState(
        event.threadId,
      );
      if (!existingThread) {
        throw new Error(
          `Cannot project run "${event.runId}" without thread "${event.threadId}".`,
        );
      }

      const nextRun: RunState = {
        id: event.runId!,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        kind: event.payload.kind,
        provider: event.payload.provider,
        model: event.payload.model,
        effort: event.payload.effort,
        status: event.payload.status,
        activePhase: null,
        progress: {
          completed: 0,
          total: event.payload.totalPhases,
        },
        startedAt: event.payload.startedAt,
        finishedAt: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      repositories.runs.upsertRunState(nextRun);
      repositories.threads.upsertThreadState({
        ...existingThread,
        latestRunId: event.runId,
        updatedAt: Math.max(existingThread.updatedAt, event.occurredAt),
      });
      return;
    }
    case "run.status.changed": {
      const run = repositories.runs.getRunState(event.runId!);
      if (!run) {
        throw new Error(
          `Cannot project status for missing run "${event.runId}".`,
        );
      }
      repositories.runs.upsertRunState({
        ...run,
        status: event.payload.status,
        activePhase: event.payload.activePhase,
        progress: { ...event.payload.progress },
        failedPhase: event.payload.failedPhase,
        failure: event.payload.failure,
        finishedAt:
          event.payload.finishedAt === undefined
            ? run.finishedAt
            : event.payload.finishedAt,
        updatedAt: event.occurredAt,
      });

      const thread = repositories.threads.getThreadState(run.threadId);
      if (thread) {
        repositories.threads.upsertThreadState({
          ...thread,
          latestRunId: run.id,
          latestTerminalStatus:
            event.payload.status === "completed" ||
            event.payload.status === "failed" ||
            event.payload.status === "cancelled"
              ? event.payload.status
              : thread.latestTerminalStatus,
          updatedAt: Math.max(thread.updatedAt, event.occurredAt),
        });
      }
      return;
    }
    case "phase.started": {
      const run = repositories.runs.getRunState(event.runId!);
      if (!run) {
        throw new Error(
          `Cannot project phase start for missing run "${event.runId}".`,
        );
      }

      const latestTurn =
        repositories.phaseTurnSummaries.getLatestPhaseTurnByRunAndPhase(
          event.runId!,
          event.payload.phase,
        );
      const turn: PhaseTurnSummaryState = {
        id: `phase-turn-${nanoid()}`,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        runId: event.runId!,
        phase: event.payload.phase,
        turnIndex: latestTurn ? latestTurn.turnIndex + 1 : 1,
        status: "running",
        startedAt: event.occurredAt,
        completedAt: null,
        lastEventId: event.id,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      repositories.phaseTurnSummaries.upsertPhaseTurnSummary(turn);
      return;
    }
    case "phase.completed": {
      const latestTurn =
        repositories.phaseTurnSummaries.getLatestPhaseTurnByRunAndPhase(
          event.runId!,
          event.payload.phase,
        );
      if (!latestTurn) {
        throw new Error(
          `Cannot project phase completion for "${event.payload.phase}" without an active phase turn.`,
        );
      }
      repositories.phaseTurnSummaries.upsertPhaseTurnSummary({
        ...latestTurn,
        status: "completed",
        summary: event.payload.summary,
        completedAt: event.occurredAt,
        lastEventId: event.id,
        updatedAt: event.occurredAt,
      });
      return;
    }
    case "phase.activity.recorded": {
      const activity: ActivityEntry = {
        id: event.id,
        eventId: event.id,
        sequence: event.sequence,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        runId: event.runId!,
        phase: event.payload.phase,
        scope: "analysis-phase",
        kind: event.payload.kind,
        message: event.payload.message,
        toolName: event.payload.toolName,
        query: event.payload.query,
        occurredAt: event.occurredAt,
        causedByEventId: event.causedByEventId,
      };
      repositories.activities.upsertActivityEntry(activity);

      const run = repositories.runs.getRunState(event.runId!);
      if (run) {
        repositories.runs.upsertRunState({
          ...run,
          latestActivityAt: event.occurredAt,
          latestActivity: {
            kind: event.payload.kind,
            message: event.payload.message,
          },
          updatedAt: Math.max(run.updatedAt, event.occurredAt),
        });
      }

      const thread = repositories.threads.getThreadState(event.threadId);
      if (thread) {
        repositories.threads.upsertThreadState(
          updateThreadActivity(thread, event.occurredAt),
        );
      }
      return;
    }
    case "thread.activity.recorded": {
      const activity: ActivityEntry = {
        id: event.payload.activityId,
        eventId: event.id,
        sequence: event.sequence,
        workspaceId: event.workspaceId,
        threadId: event.threadId,
        scope: event.payload.scope,
        kind: event.payload.kind,
        message: event.payload.message,
        status: event.payload.status,
        toolName: event.payload.toolName,
        query: event.payload.query,
        occurredAt: event.payload.occurredAt,
        causedByEventId: event.causedByEventId,
      };
      repositories.activities.upsertActivityEntry(activity);

      const thread = repositories.threads.getThreadState(event.threadId);
      if (thread) {
        repositories.threads.upsertThreadState(
          updateThreadActivity(thread, event.payload.occurredAt),
        );
      }
      return;
    }
    case "run.completed":
    case "run.failed":
    case "run.cancelled": {
      const run = repositories.runs.getRunState(event.runId!);
      if (!run) {
        throw new Error(
          `Cannot project terminal event "${event.type}" for missing run "${event.runId}".`,
        );
      }

      if (event.type === "run.failed" || event.type === "run.cancelled") {
        const activePhase =
          event.type === "run.failed"
            ? event.payload.activePhase
            : event.payload.activePhase;
        if (activePhase) {
          const latestTurn =
            repositories.phaseTurnSummaries.getLatestPhaseTurnByRunAndPhase(
              event.runId!,
              activePhase,
            );
          if (latestTurn && latestTurn.status === "running") {
            repositories.phaseTurnSummaries.upsertPhaseTurnSummary({
              ...latestTurn,
              status: event.type === "run.failed" ? "failed" : "cancelled",
              failure:
                event.type === "run.failed" ? event.payload.error : undefined,
              completedAt: event.payload.finishedAt,
              lastEventId: event.id,
              updatedAt: event.occurredAt,
            });
          }
        }
      }

      const terminalStatus =
        event.type === "run.completed"
          ? "completed"
          : event.type === "run.failed"
            ? "failed"
            : "cancelled";

      repositories.runs.upsertRunState({
        ...run,
        status: terminalStatus,
        finishedAt: event.payload.finishedAt,
        failure:
          event.type === "run.failed" ? event.payload.error : run.failure,
        updatedAt: event.occurredAt,
      });

      const thread = repositories.threads.getThreadState(run.threadId);
      if (thread) {
        repositories.threads.upsertThreadState({
          ...thread,
          latestRunId: run.id,
          latestTerminalStatus: terminalStatus,
          updatedAt: Math.max(thread.updatedAt, event.occurredAt),
        });
      }
      return;
    }
  }
}

function resolveRunContext(
  repositories: DomainProjectorDependencies,
  runId: string,
): { workspaceId: string; threadId: string } {
  const run = repositories.runs.getRunState(runId);
  if (!run) {
    throw new Error(
      `Cannot resolve workspace/thread for missing run "${runId}".`,
    );
  }

  return {
    workspaceId: run.workspaceId,
    threadId: run.threadId,
  };
}

export function createDomainEventStore(input: {
  db: DatabaseSync;
  workspaces: WorkspaceRepository;
  threads: ThreadRepository;
  messages: MessageRepository;
  runs: RunRepository;
  activities: ActivityRepository;
  phaseTurnSummaries: PhaseTurnSummaryRepository;
  domainEvents: DomainEventRepository;
}): DomainEventStore {
  const repositories: DomainProjectorDependencies = {
    threads: input.threads,
    messages: input.messages,
    runs: input.runs,
    activities: input.activities,
    phaseTurnSummaries: input.phaseTurnSummaries,
  };

  return {
    appendEvents(events) {
      if (events.length === 0) {
        return [];
      }

      return transaction(input.db, () => {
        const lastEventByRunId = new Map<string, DomainEvent | undefined>();
        const persisted: DomainEvent[] = [];

        for (const rawEvent of events) {
          const recordedAt = Date.now();
          let workspaceId = rawEvent.workspaceId;
          let threadId = rawEvent.threadId;

          if (rawEvent.runId && (!workspaceId || !threadId)) {
            const resolved = resolveRunContext(repositories, rawEvent.runId);
            workspaceId ??= resolved.workspaceId;
            threadId ??= resolved.threadId;
          }

          if (!workspaceId || !threadId) {
            throw new Error(
              `Domain event "${rawEvent.type}" is missing workspace/thread context.`,
            );
          }

          const priorForRun =
            rawEvent.runId === undefined
              ? undefined
              : lastEventByRunId.has(rawEvent.runId)
                ? lastEventByRunId.get(rawEvent.runId)
                : input.domainEvents.getLastEventByRunId(rawEvent.runId);

          const stored = input.domainEvents.insertRecord({
            id: rawEvent.id ?? createDomainEventId(),
            workspaceId,
            threadId,
            runId: rawEvent.runId ?? null,
            eventType: rawEvent.type,
            payloadJson: stringifyJson(rawEvent.payload),
            occurredAt: rawEvent.occurredAt ?? recordedAt,
            recordedAt,
            commandId: rawEvent.commandId ?? null,
            receiptId: rawEvent.receiptId ?? null,
            correlationId: rawEvent.correlationId ?? null,
            causationId: rawEvent.causationId ?? null,
            causedByEventId:
              rawEvent.causedByEventId ?? priorForRun?.id ?? null,
            producer: rawEvent.producer ?? "unknown",
            schemaVersion:
              rawEvent.schemaVersion ?? DOMAIN_EVENT_SCHEMA_VERSION,
          });
          projectEvent(stored, repositories);
          persisted.push(stored);

          if (stored.runId) {
            lastEventByRunId.set(stored.runId, stored);
          }
        }

        return persisted;
      });
    },
    getLastEventByRunId(runId) {
      return input.domainEvents.getLastEventByRunId(runId);
    },
    listEventsByRunId(runId) {
      return input.domainEvents.listEventsByRunId(runId);
    },
    resolveThreadContext(options) {
      const resolved = resolveThreadContext(input.workspaces, input.threads, {
        workspaceId: options.workspaceId,
        threadId: options.threadId,
        threadTitle: options.threadTitle,
      });
      const occurredAt = options.occurredAt ?? Date.now();
      return {
        workspaceId: resolved.workspaceId,
        threadId: resolved.threadId,
        threadTitle: resolved.threadTitle,
        createdThreadEvent: resolved.threadExists
          ? undefined
          : {
              type: "thread.created",
              workspaceId: resolved.workspaceId,
              threadId: resolved.threadId,
              payload: {
                title: resolved.threadTitle || PRIMARY_THREAD_TITLE,
                isPrimary: options.threadId === undefined,
              },
              commandId: options.commandId,
              receiptId: options.receiptId,
              correlationId: options.correlationId,
              causationId: options.causationId,
              occurredAt,
              producer: options.producer,
              schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
            },
      };
    },
  };
}
