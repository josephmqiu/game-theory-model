import type {
  WorkspaceRuntimeChatEvent,
  WorkspaceRuntimePushEnvelope,
} from "../../../shared/types/workspace-runtime";

const revisionByKey = new Map<string, number>();
const terminalPushByKey = new Map<
  string,
  WorkspaceRuntimePushEnvelope<"chat-event">
>();
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

function isTerminalChatEvent(event: WorkspaceRuntimeChatEvent): boolean {
  return (
    event.type === "chat.message.complete" || event.type === "chat.message.error"
  );
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

  if (isTerminalChatEvent(input.event)) {
    terminalPushByKey.set(key, push);
  } else {
    terminalPushByKey.delete(key);
  }

  for (const listener of listeners) {
    listener(push);
  }
}

export function listWorkspaceRuntimeChatReplayPushes(input: {
  workspaceId: string;
  activeChatCorrelations?: string[];
}): WorkspaceRuntimePushEnvelope<"chat-event">[] {
  if (!input.activeChatCorrelations?.length) {
    return [];
  }

  const activeCorrelations = new Set(input.activeChatCorrelations);

  return [...terminalPushByKey.values()]
    .filter(
      (push) =>
        push.scope.workspaceId === input.workspaceId &&
        activeCorrelations.has(push.payload.correlationId),
    )
    .map((push) => ({
      ...push,
      replayed: true,
    }));
}

export function _resetWorkspaceRuntimeChatPublisherForTest(): void {
  revisionByKey.clear();
  terminalPushByKey.clear();
}
