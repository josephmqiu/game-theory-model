import type { WorkspaceRuntimeBootstrap } from "../../../shared/types/workspace-runtime";
import type { MessageRepository } from "./message-repository";
import type { QuestionRepository } from "./question-repository";
import type { RunRepository } from "./run-repository";
import type { ActivityRepository } from "./activity-repository";
import type { PhaseTurnSummaryRepository } from "./phase-turn-summary-repository";
import type { ThreadRepository } from "./thread-repository";
import type {
  DurableMessageRole,
  ThreadMessageState,
  ThreadState,
} from "../../../shared/types/workspace-state";
import type { PendingInteractionState } from "../../../shared/types/user-input";

export interface WorkspaceRuntimeQueryDatabase {
  threads: ThreadRepository;
  messages: MessageRepository;
  activities: ActivityRepository;
  runs: RunRepository;
  phaseTurnSummaries: PhaseTurnSummaryRepository;
  questions?: QuestionRepository;
}

interface WorkspaceRuntimeSnapshotCore {
  workspaceId: string;
  threads: ThreadState[];
  activeThreadId?: string;
  activeThreadDetail: WorkspaceRuntimeBootstrap["activeThreadDetail"];
  latestRun: WorkspaceRuntimeBootstrap["latestRun"];
  latestPhaseTurns: WorkspaceRuntimeBootstrap["latestPhaseTurns"];
}

function resolveActiveThreadId(
  threads: ThreadState[],
  requestedThreadId?: string,
): string | undefined {
  if (
    requestedThreadId &&
    threads.some((thread) => thread.id === requestedThreadId)
  ) {
    return requestedThreadId;
  }

  return threads.find((thread) => thread.isPrimary)?.id ?? threads[0]?.id;
}

function parseThreadMessageState(
  raw: string,
  fallback: ThreadMessageState,
): ThreadMessageState {
  try {
    return JSON.parse(raw) as ThreadMessageState;
  } catch (err) {
    console.warn(
      "[workspace-runtime-query] failed to parse thread message state:",
      err,
    );
    return fallback;
  }
}

function getThreadDetail(
  database: WorkspaceRuntimeQueryDatabase,
  threadId?: string,
): WorkspaceRuntimeBootstrap["activeThreadDetail"] {
  if (!threadId) {
    return null;
  }

  const thread = database.threads.getThreadState(threadId);
  if (!thread) {
    return null;
  }

  const pendingInteractions: PendingInteractionState[] = database.questions
    ? database.questions.listByThreadId(threadId, "pending")
    : [];

  return {
    thread,
    messages: database.messages
      .listMessagesByThreadId(threadId)
      .map((message) =>
        parseThreadMessageState(message.messageJson, {
          id: message.id,
          workspaceId: message.workspaceId,
          threadId: message.threadId,
          role: message.role as DurableMessageRole,
          content: message.content,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          source: "chat",
          kind:
            (message.role as DurableMessageRole) === "user"
              ? "user-turn"
              : "assistant-turn",
        }),
      ),
    activities: database.activities.listActivitiesByThreadId(threadId),
    ...(pendingInteractions.length > 0 ? { pendingInteractions } : {}),
  };
}

function getLatestRunDetail(
  database: WorkspaceRuntimeQueryDatabase,
  threadId?: string,
): Pick<WorkspaceRuntimeSnapshotCore, "latestRun" | "latestPhaseTurns"> {
  if (!threadId) {
    return {
      latestRun: null,
      latestPhaseTurns: [],
    };
  }

  const latestRun = database.runs.listRunsByThreadId(threadId)[0] ?? null;
  if (!latestRun) {
    return {
      latestRun: null,
      latestPhaseTurns: [],
    };
  }

  return {
    latestRun,
    latestPhaseTurns: database.phaseTurnSummaries.listPhaseTurnSummariesByRunId(
      latestRun.id,
    ),
  };
}

export function buildWorkspaceRuntimeSnapshotCore(
  database: WorkspaceRuntimeQueryDatabase,
  input: {
    workspaceId: string;
    activeThreadId?: string;
  },
): WorkspaceRuntimeSnapshotCore {
  const threads = database.threads.listThreadsByWorkspaceId(input.workspaceId);
  const activeThreadId = resolveActiveThreadId(threads, input.activeThreadId);
  const activeThreadDetail = getThreadDetail(database, activeThreadId);
  const latestRunDetail = getLatestRunDetail(database, activeThreadId);

  return {
    workspaceId: input.workspaceId,
    threads,
    ...(activeThreadId ? { activeThreadId } : {}),
    activeThreadDetail,
    latestRun: latestRunDetail.latestRun,
    latestPhaseTurns: latestRunDetail.latestPhaseTurns,
  };
}

export function buildThreadsPushPayload(
  database: WorkspaceRuntimeQueryDatabase,
  workspaceId: string,
) {
  return {
    workspaceId,
    threads: database.threads.listThreadsByWorkspaceId(workspaceId),
  };
}

export function buildThreadDetailPushPayload(
  database: WorkspaceRuntimeQueryDatabase,
  workspaceId: string,
  threadId?: string,
) {
  return {
    workspaceId,
    ...(threadId ? { threadId } : {}),
    detail: getThreadDetail(database, threadId),
  };
}

export function buildRunDetailPushPayload(
  database: WorkspaceRuntimeQueryDatabase,
  workspaceId: string,
  threadId?: string,
) {
  const latestRunDetail = getLatestRunDetail(database, threadId);
  return {
    workspaceId,
    ...(threadId ? { threadId } : {}),
    latestRun: latestRunDetail.latestRun,
    latestPhaseTurns: latestRunDetail.latestPhaseTurns,
  };
}
