import { nanoid } from "nanoid";
import type {
  ActivityEntry,
  ActivityScope,
  ActivityStatus,
  DurableMessageRole,
  ThreadMessageState,
  ThreadState,
} from "../../../shared/types/workspace-state";
import { getWorkspaceDatabase, type WorkspaceDatabase } from "./workspace-db";
import type { AnyDomainEventInput } from "./domain-event-types";

export interface EnsureThreadInput {
  workspaceId?: string;
  threadId?: string;
  threadTitle?: string;
  producer: string;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt?: number;
}

export interface CreateThreadInput {
  workspaceId: string;
  title?: string;
  producer: string;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt?: number;
}

export interface ThreadDetail {
  workspaceId: string;
  thread: ThreadState;
  messages: ThreadMessageState[];
  activities: ActivityEntry[];
}

export interface RecordThreadMessageInput {
  workspaceId: string;
  threadId: string;
  role: DurableMessageRole;
  content: string;
  attachments?: ThreadMessageState["attachments"];
  messageId?: string;
  producer: string;
  occurredAt?: number;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
}

export interface RecordThreadActivityInput {
  workspaceId: string;
  threadId: string;
  scope: ActivityScope;
  kind: ActivityEntry["kind"];
  message: string;
  status?: ActivityStatus;
  toolName?: string;
  query?: string;
  activityId?: string;
  producer: string;
  occurredAt?: number;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
}

function parseThreadMessageState(raw: string, fallback: {
  id: string;
  workspaceId: string;
  threadId: string;
  role: DurableMessageRole;
  content: string;
  createdAt: number;
  updatedAt: number;
}): ThreadMessageState {
  try {
    return JSON.parse(raw) as ThreadMessageState;
  } catch {
    return fallback;
  }
}

export function deriveThreadTitleFromMessage(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length === 0) {
    return "New Chat";
  }
  return clean.length <= 48 ? clean : `${clean.slice(0, 45).trimEnd()}...`;
}

export function createThreadService(
  database: WorkspaceDatabase = getWorkspaceDatabase(),
) {
  return {
    listThreadsByWorkspaceId(workspaceId: string): ThreadState[] {
      return database.threads.listThreadsByWorkspaceId(workspaceId);
    },

    getThreadById(threadId: string): ThreadState | undefined {
      return database.threads.getThreadState(threadId);
    },

    getThreadDetailById(threadId: string): ThreadDetail | undefined {
      const thread = database.threads.getThreadState(threadId);
      if (!thread) {
        return undefined;
      }

      return {
        workspaceId: thread.workspaceId,
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
            }),
          ),
        activities: database.activities.listActivitiesByThreadId(threadId),
      };
    },

    createThread(input: CreateThreadInput): ThreadState {
      const threadId = `${input.workspaceId}:thread-${nanoid()}`;
      const threadTitle = input.title?.trim() || "New Chat";

      this.ensureThread({
        workspaceId: input.workspaceId,
        threadId,
        threadTitle,
        producer: input.producer,
        commandId: input.commandId,
        receiptId: input.receiptId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        occurredAt: input.occurredAt,
      });

      const thread = database.threads.getThreadState(threadId);
      if (!thread) {
        throw new Error(`Failed to persist thread "${threadId}".`);
      }

      return thread;
    },

    ensureThread(input: EnsureThreadInput) {
      const resolved = database.eventStore.resolveThreadContext({
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        threadTitle: input.threadTitle,
        producer: input.producer,
        commandId: input.commandId,
        receiptId: input.receiptId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        occurredAt: input.occurredAt,
      });

      if (resolved.createdThreadEvent) {
        database.eventStore.appendEvents([
          resolved.createdThreadEvent as AnyDomainEventInput,
        ]);
      }

      return resolved;
    },

    listMessagesByThreadId(threadId: string): ThreadMessageState[] {
      return database.messages.listMessagesByThreadId(threadId).map((message) =>
        parseThreadMessageState(message.messageJson, {
          id: message.id,
          workspaceId: message.workspaceId,
          threadId: message.threadId,
          role: message.role as DurableMessageRole,
          content: message.content,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        }),
      );
    },

    recordMessage(input: RecordThreadMessageInput): ThreadMessageState {
      const occurredAt = input.occurredAt ?? Date.now();
      const messageId = input.messageId ?? `msg-${nanoid()}`;
      database.eventStore.appendEvents([
        {
          type: "message.recorded",
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          payload: {
            messageId,
            role: input.role,
            content: input.content,
            ...(input.attachments?.length
              ? { attachments: input.attachments }
              : {}),
            createdAt: occurredAt,
            updatedAt: occurredAt,
          },
          commandId: input.commandId,
          receiptId: input.receiptId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          occurredAt,
          producer: input.producer,
        },
      ]);

      const stored = database.messages.getMessage(messageId);
      if (!stored) {
        throw new Error(`Failed to persist message "${messageId}".`);
      }

      return parseThreadMessageState(stored.messageJson, {
        id: stored.id,
        workspaceId: stored.workspaceId,
        threadId: stored.threadId,
        role: stored.role as DurableMessageRole,
        content: stored.content,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      });
    },

    recordActivity(input: RecordThreadActivityInput): ActivityEntry {
      const occurredAt = input.occurredAt ?? Date.now();
      const activityId = input.activityId ?? `activity-${nanoid()}`;
      const [event] = database.eventStore.appendEvents([
        {
          type: "thread.activity.recorded",
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          payload: {
            activityId,
            scope: input.scope,
            kind: input.kind,
            message: input.message,
            status: input.status,
            toolName: input.toolName,
            query: input.query,
            occurredAt,
          },
          commandId: input.commandId,
          receiptId: input.receiptId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          occurredAt,
          producer: input.producer,
        },
      ]);

      const stored = database.activities.getActivityEntry(activityId);
      if (!stored || !event) {
        throw new Error(`Failed to persist activity "${activityId}".`);
      }
      return stored;
    },
  };
}

export type ThreadService = ReturnType<typeof createThreadService>;
