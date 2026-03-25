import { createWorkspaceRecordFromSnapshot } from "./workspace-repository";
import type { ThreadRepository } from "./thread-repository";
import type { WorkspaceRepository } from "./workspace-repository";

export const DEFAULT_WORKSPACE_ID = "workspace-local-default";
export const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";
export const PRIMARY_THREAD_SUFFIX = "primary-thread";
export const PRIMARY_THREAD_TITLE = "Primary Thread";

export interface ResolvedThreadContext {
  workspaceId: string;
  threadId: string;
  threadTitle: string;
  threadExists: boolean;
}

function createWorkspaceSnapshot(id: string, name: string, now: number): unknown {
  return {
    id,
    name,
    analysisType: "game-theory",
    createdAt: now,
    updatedAt: now,
    analysis: {
      id: `${id}-analysis`,
      name,
      topic: "",
      entities: [],
      relationships: [],
      phases: [],
    },
    layout: {},
    threads: [],
    artifacts: [],
    checkpointHeaders: [],
    pendingQuestions: [],
  };
}

export function ensureWorkspaceRecord(
  workspaces: WorkspaceRepository,
  workspaceId: string,
  name = DEFAULT_WORKSPACE_NAME,
): void {
  const existing = workspaces.getWorkspace(workspaceId);
  if (existing) {
    return;
  }

  const now = Date.now();
  workspaces.upsertWorkspace(
    createWorkspaceRecordFromSnapshot({
      id: workspaceId,
      name,
      analysisType: "game-theory",
      snapshot: createWorkspaceSnapshot(workspaceId, name, now),
      createdAt: now,
      updatedAt: now,
    }),
  );
}

export function resolveWorkspaceId(
  workspaces: WorkspaceRepository,
  workspaceId?: string,
): string {
  if (workspaceId && workspaceId.trim().length > 0) {
    ensureWorkspaceRecord(workspaces, workspaceId.trim());
    return workspaceId.trim();
  }

  const latestWorkspace = workspaces.listWorkspaces()[0];
  if (latestWorkspace) {
    return latestWorkspace.id;
  }

  ensureWorkspaceRecord(workspaces, DEFAULT_WORKSPACE_ID);
  return DEFAULT_WORKSPACE_ID;
}

export function resolvePrimaryThreadId(workspaceId: string): string {
  return `${workspaceId}:${PRIMARY_THREAD_SUFFIX}`;
}

export function resolveThreadContext(
  workspaces: WorkspaceRepository,
  threads: ThreadRepository,
  input: { workspaceId?: string; threadId?: string; threadTitle?: string },
): ResolvedThreadContext {
  const workspaceId = resolveWorkspaceId(workspaces, input.workspaceId);
  const requestedThreadId = input.threadId?.trim();

  if (requestedThreadId) {
    const existing = threads.getThreadState(requestedThreadId);
    return {
      workspaceId,
      threadId: requestedThreadId,
      threadTitle: existing?.title ?? input.threadTitle?.trim() ?? requestedThreadId,
      threadExists: existing !== undefined,
    };
  }

  const primaryThreadId = resolvePrimaryThreadId(workspaceId);
  const primaryThread = threads.getThreadState(primaryThreadId);
  return {
    workspaceId,
    threadId: primaryThreadId,
    threadTitle: primaryThread?.title ?? PRIMARY_THREAD_TITLE,
    threadExists: primaryThread !== undefined,
  };
}
