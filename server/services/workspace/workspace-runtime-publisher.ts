import type {
  WorkspaceRuntimeChannel,
  WorkspaceRuntimeChannelRevisions,
  WorkspaceRuntimePushEnvelope,
} from "../../../shared/types/workspace-runtime";
import {
  buildRunDetailPushPayload,
  buildThreadDetailPushPayload,
  buildThreadsPushPayload,
  type WorkspaceRuntimeQueryDatabase,
} from "./workspace-runtime-query";

const CHANNEL_ORDER: WorkspaceRuntimeChannel[] = [
  "threads",
  "thread-detail",
  "run-detail",
];

const latestPushByKey = new Map<string, WorkspaceRuntimePushEnvelope>();
const revisionByKey = new Map<string, number>();
const listeners = new Set<(push: WorkspaceRuntimePushEnvelope) => void>();

function getPushKey(
  channel: WorkspaceRuntimeChannel,
  scope: { workspaceId: string; threadId?: string },
): string {
  return `${channel}:${scope.workspaceId}:${scope.threadId ?? ""}`;
}

function nextRevision(key: string): number {
  const revision = (revisionByKey.get(key) ?? 0) + 1;
  revisionByKey.set(key, revision);
  return revision;
}

function emitPush(push: WorkspaceRuntimePushEnvelope): void {
  latestPushByKey.set(getPushKey(push.channel, push.scope), push);
  for (const listener of listeners) {
    listener(push);
  }
}

function createPushEnvelope<TChannel extends WorkspaceRuntimeChannel>(
  channel: TChannel,
  scope: { workspaceId: string; threadId?: string },
  payload: WorkspaceRuntimePushEnvelope<TChannel>["payload"],
): WorkspaceRuntimePushEnvelope<TChannel> {
  const key = getPushKey(channel, scope);
  return {
    type: "push",
    channel,
    revision: nextRevision(key),
    scope,
    payload,
  };
}

export function onWorkspaceRuntimePush(
  listener: (push: WorkspaceRuntimePushEnvelope) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWorkspaceRuntimeChannelRevisions(input: {
  workspaceId: string;
  threadId?: string;
}): WorkspaceRuntimeChannelRevisions {
  const revisions: WorkspaceRuntimeChannelRevisions = {};
  for (const channel of CHANNEL_ORDER) {
    const threadScoped = channel === "threads" ? undefined : input.threadId;
    const push = latestPushByKey.get(
      getPushKey(channel, {
        workspaceId: input.workspaceId,
        ...(threadScoped ? { threadId: threadScoped } : {}),
      }),
    );
    if (push) {
      revisions[channel] = push.revision;
    }
  }
  return revisions;
}

export function listWorkspaceRuntimeReplayPushes(input: {
  workspaceId: string;
  threadId?: string;
  lastSeenByChannel?: WorkspaceRuntimeChannelRevisions;
}): WorkspaceRuntimePushEnvelope[] {
  const replayable: WorkspaceRuntimePushEnvelope[] = [];

  for (const channel of CHANNEL_ORDER) {
    const threadScoped = channel === "threads" ? undefined : input.threadId;
    const push = latestPushByKey.get(
      getPushKey(channel, {
        workspaceId: input.workspaceId,
        ...(threadScoped ? { threadId: threadScoped } : {}),
      }),
    );
    if (!push) {
      continue;
    }
    const lastSeen = input.lastSeenByChannel?.[channel] ?? 0;
    if (push.revision <= lastSeen) {
      continue;
    }
    replayable.push({
      ...push,
      replayed: true,
    });
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
    emitPush(
      createPushEnvelope(
        "threads",
        { workspaceId },
        buildThreadsPushPayload(database, workspaceId),
      ),
    );
  }

  for (const { workspaceId, threadId } of threads.values()) {
    emitPush(
      createPushEnvelope(
        "thread-detail",
        { workspaceId, threadId },
        buildThreadDetailPushPayload(database, workspaceId, threadId),
      ),
    );
    emitPush(
      createPushEnvelope(
        "run-detail",
        { workspaceId, threadId },
        buildRunDetailPushPayload(database, workspaceId, threadId),
      ),
    );
  }
}

export function _resetWorkspaceRuntimePublisherForTest(): void {
  latestPushByKey.clear();
  revisionByKey.clear();
}
