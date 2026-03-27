import type {
  WorkspaceRuntimeChatEvent,
  WorkspaceRuntimePushEnvelope,
} from "../../../shared/types/workspace-runtime";

const revisionByKey = new Map<string, number>();
const listeners = new Set<
  (push: WorkspaceRuntimePushEnvelope<"chat-event">) => void
>();

function getPushKey(input: {
  workspaceId: string;
  threadId: string;
  correlationId: string;
}): string {
  return `${input.workspaceId}:${input.threadId}:${input.correlationId}`;
}

function nextRevision(key: string): number {
  const revision = (revisionByKey.get(key) ?? 0) + 1;
  revisionByKey.set(key, revision);
  return revision;
}

export function onWorkspaceRuntimeChatPush(
  listener: (push: WorkspaceRuntimePushEnvelope<"chat-event">) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishWorkspaceRuntimeChatEvent(input: {
  workspaceId: string;
  threadId: string;
  correlationId: string;
  event: WorkspaceRuntimeChatEvent;
}): void {
  const key = getPushKey(input);
  const push: WorkspaceRuntimePushEnvelope<"chat-event"> = {
    type: "push",
    channel: "chat-event",
    revision: nextRevision(key),
    scope: {
      workspaceId: input.workspaceId,
      threadId: input.threadId,
    },
    payload: {
      correlationId: input.correlationId,
      event: input.event,
    },
  };

  for (const listener of listeners) {
    listener(push);
  }
}

export function _resetWorkspaceRuntimeChatPublisherForTest(): void {
  revisionByKey.clear();
}
