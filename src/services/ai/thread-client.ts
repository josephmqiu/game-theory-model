import type {
  ActivityEntry,
  ThreadMessageState,
  ThreadState,
} from "../../../shared/types/workspace-state";

export interface ThreadListResponse {
  workspaceId: string;
  threads: ThreadState[];
}

export interface ThreadDetailResponse {
  workspaceId: string;
  thread: ThreadState;
  messages: ThreadMessageState[];
  activities: ActivityEntry[];
}

export interface CreateThreadResponse {
  workspaceId: string;
  thread: ThreadState;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchThreads(
  workspaceId: string,
): Promise<ThreadListResponse> {
  const query = new URLSearchParams({ workspaceId });
  const response = await fetch(`/api/workspace/threads?${query.toString()}`);
  return parseJsonResponse<ThreadListResponse>(response);
}

export async function fetchThreadDetail(
  threadId: string,
  workspaceId?: string,
): Promise<ThreadDetailResponse> {
  const params: Record<string, string> = { threadId };
  if (workspaceId) {
    params.workspaceId = workspaceId;
  }
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/workspace/thread?${query.toString()}`);
  return parseJsonResponse<ThreadDetailResponse>(response);
}

export async function createThread(input: {
  workspaceId: string;
  title?: string;
}): Promise<CreateThreadResponse> {
  const response = await fetch("/api/workspace/thread", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<CreateThreadResponse>(response);
}
