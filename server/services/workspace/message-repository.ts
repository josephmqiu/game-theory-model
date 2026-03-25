import type { DatabaseSync } from "node:sqlite";
import type { MessageRecord } from "./workspace-types";

export interface MessageRepository {
  upsertMessage(message: MessageRecord): MessageRecord;
  getMessage(id: string): MessageRecord | undefined;
  listMessagesByThreadId(threadId: string): MessageRecord[];
  clear(): void;
}

function mapMessageRow(row: Record<string, unknown>): MessageRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    threadId: String(row.thread_id),
    role: String(row.role),
    content: String(row.content),
    messageJson: String(row.message_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function createMessageRepository(db: DatabaseSync): MessageRepository {
  const getStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, role, content, message_json, created_at, updated_at
     FROM messages
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, role, content, message_json, created_at, updated_at
     FROM messages
     WHERE thread_id = $threadId
     ORDER BY created_at ASC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO messages (
       id, workspace_id, thread_id, role, content, message_json, created_at, updated_at
     ) VALUES (
       $id, $workspaceId, $threadId, $role, $content, $messageJson, $createdAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       role = excluded.role,
       content = excluded.content,
       message_json = excluded.message_json,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM messages`);

  return {
    upsertMessage(message) {
      upsertStatement.run({
        $id: message.id,
        $workspaceId: message.workspaceId,
        $threadId: message.threadId,
        $role: message.role,
        $content: message.content,
        $messageJson: message.messageJson,
        $createdAt: message.createdAt,
        $updatedAt: message.updatedAt,
      });

      const stored = getStatement.get({ $id: message.id });
      if (!stored) {
        throw new Error(`Failed to persist message "${message.id}".`);
      }
      return mapMessageRow(stored);
    },
    getMessage(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapMessageRow(row) : undefined;
    },
    listMessagesByThreadId(threadId) {
      return listStatement
        .all({ $threadId: threadId })
        .map((row) => mapMessageRow(row));
    },
    clear() {
      clearStatement.run();
    },
  };
}
