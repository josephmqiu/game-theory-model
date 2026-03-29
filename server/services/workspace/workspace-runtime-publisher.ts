import type {
  WorkspaceRuntimeAnalysisMutationEvent,
  WorkspaceRuntimeAnalysisProgressEvent,
  WorkspaceRuntimeAnalysisStatusEvent,
  WorkspaceRuntimeChatMessageCompleteEvent,
  WorkspaceRuntimeChatMessageErrorEvent,
  WorkspaceRuntimeChatToolErrorEvent,
  WorkspaceRuntimeChatToolResultEvent,
  WorkspaceRuntimeChatToolStartEvent,
  WorkspaceRuntimeEventByTopic,
  WorkspaceRuntimePushEnvelope,
  WorkspaceRuntimeTopic,
  WorkspaceRuntimeTopicRevisions,
} from "../../../shared/types/workspace-runtime";
import type {
  AnalysisMutationEvent,
  AnalysisProgressEvent,
} from "../../../shared/types/events";
import type { RunStatus } from "../../../shared/types/api";
import {
  buildRunDetailPushPayload,
  buildThreadDetailPushPayload,
  buildThreadsPushPayload,
  type WorkspaceRuntimeQueryDatabase,
} from "./workspace-runtime-query";

const BROADCAST_WORKSPACE_ID = "__broadcast__";
const TOPIC_ORDER: WorkspaceRuntimeTopic[] = [
  "threads",
  "thread-detail",
  "run-detail",
  "analysis",
  "chat",
];

const latestPushByKey = new Map<string, WorkspaceRuntimePushEnvelope>();
const revisionByKey = new Map<string, number>();
const terminalChatPushByKey = new Map<string, WorkspaceRuntimePushEnvelope<"chat">>();
const listeners = new Set<(push: WorkspaceRuntimePushEnvelope) => void>();

function getPushKey(
  topic: WorkspaceRuntimeTopic,
  scope: { workspaceId: string; threadId?: string },
): string {
  return `${topic}:${scope.workspaceId}:${scope.threadId ?? ""}`;
}

function nextRevision(key: string): number {
  const revision = (revisionByKey.get(key) ?? 0) + 1;
  revisionByKey.set(key, revision);
  return revision;
}

function emitPush<TTopic extends WorkspaceRuntimeTopic>(
  push: WorkspaceRuntimePushEnvelope<TTopic>,
): void {
  latestPushByKey.set(getPushKey(push.topic, push.scope), push);
  for (const listener of listeners) {
    listener(push);
  }
}

function createPushEnvelope<TTopic extends WorkspaceRuntimeTopic>(
  topic: TTopic,
  scope: { workspaceId: string; threadId?: string },
  event: WorkspaceRuntimeEventByTopic[TTopic],
): WorkspaceRuntimePushEnvelope<TTopic> {
  const key = getPushKey(topic, scope);
  return {
    type: "push",
    topic,
    revision: nextRevision(key),
    scope,
    event,
  };
}

function createThreadsPush(
  scope: { workspaceId: string },
  database: WorkspaceRuntimeQueryDatabase,
): WorkspaceRuntimePushEnvelope<"threads"> {
  return createPushEnvelope("threads", scope, {
    kind: "threads.updated",
    ...buildThreadsPushPayload(database, scope.workspaceId),
  });
}

function createThreadDetailPush(
  scope: { workspaceId: string; threadId?: string },
  database: WorkspaceRuntimeQueryDatabase,
): WorkspaceRuntimePushEnvelope<"thread-detail"> {
  return createPushEnvelope("thread-detail", scope, {
    kind: "thread.detail.updated",
    ...buildThreadDetailPushPayload(database, scope.workspaceId, scope.threadId),
  });
}

function createRunDetailPush(
  scope: { workspaceId: string; threadId?: string },
  database: WorkspaceRuntimeQueryDatabase,
): WorkspaceRuntimePushEnvelope<"run-detail"> {
  return createPushEnvelope("run-detail", scope, {
    kind: "run.detail.updated",
    ...buildRunDetailPushPayload(database, scope.workspaceId, scope.threadId),
  });
}

function getTerminalChatPushKey(input: {
  workspaceId: string;
  threadId: string;
  correlationId: string;
}): string {
  return `${input.workspaceId}:${input.threadId}:${input.correlationId}`;
}

function isTerminalChatEvent(
  event: WorkspaceRuntimeEventByTopic["chat"],
): event is
  | WorkspaceRuntimeChatMessageCompleteEvent
  | WorkspaceRuntimeChatMessageErrorEvent {
  return (
    event.kind === "chat.message.complete" || event.kind === "chat.message.error"
  );
}

export function onWorkspaceRuntimePush(
  listener: (push: WorkspaceRuntimePushEnvelope) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWorkspaceRuntimeTopicRevisions(input: {
  workspaceId: string;
  threadId?: string;
}): WorkspaceRuntimeTopicRevisions {
  const revisions: WorkspaceRuntimeTopicRevisions = {};

  for (const topic of TOPIC_ORDER) {
    if (topic === "chat") {
      continue;
    }

    const workspaceId =
      topic === "analysis" ? BROADCAST_WORKSPACE_ID : input.workspaceId;
    const threadId =
      topic === "threads" || topic === "analysis" ? undefined : input.threadId;
    const push = latestPushByKey.get(
      getPushKey(topic, { workspaceId, ...(threadId ? { threadId } : {}) }),
    );
    if (push) {
      revisions[topic] = push.revision;
    }
  }

  return revisions;
}

export function listWorkspaceRuntimeReplayPushes(input: {
  workspaceId: string;
  threadId?: string;
  lastSeenByTopic?: WorkspaceRuntimeTopicRevisions;
  activeChatCorrelations?: string[];
}): WorkspaceRuntimePushEnvelope[] {
  const replayable: WorkspaceRuntimePushEnvelope[] = [];

  for (const topic of TOPIC_ORDER) {
    if (topic === "chat") {
      continue;
    }

    const workspaceId =
      topic === "analysis" ? BROADCAST_WORKSPACE_ID : input.workspaceId;
    const threadId =
      topic === "threads" || topic === "analysis" ? undefined : input.threadId;
    const push = latestPushByKey.get(
      getPushKey(topic, { workspaceId, ...(threadId ? { threadId } : {}) }),
    );
    if (!push) {
      continue;
    }

    const lastSeen = input.lastSeenByTopic?.[topic] ?? 0;
    if (push.revision <= lastSeen) {
      continue;
    }

    replayable.push({
      ...push,
      scope:
        topic === "analysis"
          ? { workspaceId: input.workspaceId }
          : push.scope,
      replayed: true,
    });
  }

  if (input.activeChatCorrelations?.length) {
    const activeCorrelations = new Set(input.activeChatCorrelations);
    for (const push of terminalChatPushByKey.values()) {
      const event = push.event;
      if (!activeCorrelations.has(event.correlationId)) {
        continue;
      }
      if (push.scope.workspaceId !== input.workspaceId) {
        continue;
      }
      replayable.push({
        ...push,
        replayed: true,
      });
    }
  }

  return replayable;
}

export function publishWorkspaceRuntimeUpdates(
  database: WorkspaceRuntimeQueryDatabase,
  events: Array<{
    workspaceId: string;
    threadId: string;
  }>,
): void {
  if (events.length === 0) {
    return;
  }

  const workspaces = new Set<string>();
  const threads = new Map<string, { workspaceId: string; threadId: string }>();

  for (const event of events) {
    workspaces.add(event.workspaceId);
    threads.set(`${event.workspaceId}:${event.threadId}`, {
      workspaceId: event.workspaceId,
      threadId: event.threadId,
    });
  }

  for (const workspaceId of workspaces) {
    emitPush(createThreadsPush({ workspaceId }, database));
  }

  for (const { workspaceId, threadId } of threads.values()) {
    emitPush(createThreadDetailPush({ workspaceId, threadId }, database));
    emitPush(createRunDetailPush({ workspaceId, threadId }, database));
  }
}

export function publishWorkspaceRuntimeAnalysisMutation(
  event: AnalysisMutationEvent,
): void {
  emitPush(
    createPushEnvelope(
      "analysis",
      { workspaceId: BROADCAST_WORKSPACE_ID },
      {
        kind: "analysis.mutation",
        event,
      } satisfies WorkspaceRuntimeAnalysisMutationEvent,
    ),
  );
}

export function publishWorkspaceRuntimeAnalysisStatus(runStatus: RunStatus): void {
  emitPush(
    createPushEnvelope(
      "analysis",
      { workspaceId: BROADCAST_WORKSPACE_ID },
      {
        kind: "analysis.status",
        runStatus,
      } satisfies WorkspaceRuntimeAnalysisStatusEvent,
    ),
  );
}

export function publishWorkspaceRuntimeAnalysisProgress(
  event: AnalysisProgressEvent,
): void {
  emitPush(
    createPushEnvelope(
      "analysis",
      { workspaceId: BROADCAST_WORKSPACE_ID },
      {
        kind: "analysis.progress",
        event,
      } satisfies WorkspaceRuntimeAnalysisProgressEvent,
    ),
  );
}

export function publishWorkspaceRuntimeChatEvent(input: {
  workspaceId: string;
  threadId: string;
  event:
    | WorkspaceRuntimeEventByTopic["chat"]
    | WorkspaceRuntimeChatToolStartEvent
    | WorkspaceRuntimeChatToolResultEvent
    | WorkspaceRuntimeChatToolErrorEvent;
}): void {
  const push = createPushEnvelope(
    "chat",
    {
      workspaceId: input.workspaceId,
      threadId: input.threadId,
    },
    input.event,
  );

  if (isTerminalChatEvent(input.event)) {
    terminalChatPushByKey.set(
      getTerminalChatPushKey({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        correlationId: input.event.correlationId,
      }),
      push,
    );
  }

  emitPush(push);
}

export function _resetWorkspaceRuntimePublisherForTest(): void {
  latestPushByKey.clear();
  revisionByKey.clear();
  terminalChatPushByKey.clear();
}
