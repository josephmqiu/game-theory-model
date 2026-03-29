import type { RunKind } from "../../shared/types/api";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type { ActivityEntry } from "../../shared/types/workspace-state";
import { createThreadService } from "./workspace";

interface PhaseTurnThreadInput {
  workspaceId: string;
  threadId: string;
  runId: string;
  runKind: RunKind;
  phase: MethodologyPhase;
  phaseTurnId: string;
  producer: string;
}

interface PhaseTurnActivityInput {
  kind: ActivityEntry["kind"];
  message: string;
  status?: ActivityEntry["status"];
  toolName?: string;
  query?: string;
  occurredAt?: number;
}

function buildPhaseTurnActivitySignature(
  activity: Pick<
    ActivityEntry,
    "kind" | "message" | "status" | "toolName" | "query"
  >,
): string {
  return JSON.stringify([
    activity.kind,
    activity.message,
    activity.status ?? null,
    activity.toolName ?? null,
    activity.query ?? null,
  ]);
}

function buildPhaseTurnMessageId(phaseTurnId: string, role: "user" | "assistant") {
  return `msg-${phaseTurnId}-${role}`;
}

export function createPhaseTurnThreadWriter(input: PhaseTurnThreadInput) {
  const threadService = createThreadService();
  const existingMessages = threadService
    .listMessagesByThreadId(input.threadId)
    .filter(
      (message) =>
        message.source === "analysis" &&
        message.phaseTurnId === input.phaseTurnId &&
        message.runId === input.runId,
    );
  const existingActivities =
    threadService
      .getThreadDetailById(input.threadId)
      ?.activities.filter(
        (activity) =>
          activity.phaseTurnId === input.phaseTurnId &&
          activity.runId === input.runId,
      ) ?? [];

  const recordedActivitySignatures = new Set(
    existingActivities.map((activity) =>
      buildPhaseTurnActivitySignature(activity),
    ),
  );
  let nextActivityIndex = existingActivities.length + 1;

  return {
    buildHistoryMessages() {
      return threadService
        .listMessagesByThreadId(input.threadId)
        .filter(
          (message) =>
            message.source === "analysis" &&
            message.runId === input.runId &&
            message.phaseTurnId !== input.phaseTurnId,
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
    },

    ensureUserTurn(content: string, occurredAt: number) {
      if (
        existingMessages.some(
          (message) => message.role === "user" && message.kind === "user-turn",
        )
      ) {
        return;
      }

      const message = threadService.recordMessage({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        role: "user",
        content,
        runId: input.runId,
        phaseTurnId: input.phaseTurnId,
        phase: input.phase,
        runKind: input.runKind,
        source: "analysis",
        kind: "user-turn",
        messageId: buildPhaseTurnMessageId(input.phaseTurnId, "user"),
        occurredAt,
        producer: input.producer,
      });
      existingMessages.push(message);
    },

    ensureAssistantTurn(content: string, occurredAt: number) {
      if (
        existingMessages.some(
          (message) =>
            message.role === "assistant" &&
            message.kind === "assistant-turn",
        )
      ) {
        return;
      }

      const message = threadService.recordMessage({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        role: "assistant",
        content,
        runId: input.runId,
        phaseTurnId: input.phaseTurnId,
        phase: input.phase,
        runKind: input.runKind,
        source: "analysis",
        kind: "assistant-turn",
        messageId: buildPhaseTurnMessageId(input.phaseTurnId, "assistant"),
        occurredAt,
        producer: input.producer,
      });
      existingMessages.push(message);
    },

    recordActivity(activity: PhaseTurnActivityInput) {
      const signature = buildPhaseTurnActivitySignature(activity);
      if (recordedActivitySignatures.has(signature)) {
        return;
      }

      recordedActivitySignatures.add(signature);
      threadService.recordActivity({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        runId: input.runId,
        phase: input.phase,
        phaseTurnId: input.phaseTurnId,
        scope: "analysis-phase",
        kind: activity.kind,
        message: activity.message,
        status: activity.status,
        toolName: activity.toolName,
        query: activity.query,
        activityId: `activity-${input.phaseTurnId}-${String(nextActivityIndex).padStart(4, "0")}`,
        occurredAt: activity.occurredAt,
        producer: input.producer,
      });
      nextActivityIndex += 1;
    },
  };
}
