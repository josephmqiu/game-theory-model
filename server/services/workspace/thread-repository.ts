import type { DatabaseSync } from "node:sqlite";
import type { ThreadRecord } from "./workspace-types";

export interface ThreadRepository {
  getThread(id: string): ThreadRecord | undefined;
  listThreadsByWorkspaceId(workspaceId: string): ThreadRecord[];
  upsertThread(thread: ThreadRecord): ThreadRecord;
  clear(): void;
}

function mapThreadRow(row: Record<string, unknown>): ThreadRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    threadJson: String(row.thread_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function createThreadRepository(db: DatabaseSync): ThreadRepository {
  const getStatement = db.prepare(
    `SELECT id, workspace_id, title, thread_json, created_at, updated_at
     FROM threads
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT id, workspace_id, title, thread_json, created_at, updated_at
     FROM threads
     WHERE workspace_id = $workspaceId
     ORDER BY updated_at DESC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO threads (
       id, workspace_id, title, thread_json, created_at, updated_at
     ) VALUES (
       $id, $workspaceId, $title, $threadJson, $createdAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       title = excluded.title,
       thread_json = excluded.thread_json,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM threads`);

  return {
    getThread(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapThreadRow(row) : undefined;
    },
    listThreadsByWorkspaceId(workspaceId) {
      return listStatement
        .all({ $workspaceId: workspaceId })
        .map((row) => mapThreadRow(row));
    },
    upsertThread(thread) {
      upsertStatement.run({
        $id: thread.id,
        $workspaceId: thread.workspaceId,
        $title: thread.title,
        $threadJson: thread.threadJson,
        $createdAt: thread.createdAt,
        $updatedAt: thread.updatedAt,
      });

      const stored = getStatement.get({ $id: thread.id });
      if (!stored) {
        throw new Error(`Failed to persist thread "${thread.id}".`);
      }
      return mapThreadRow(stored);
    },
    clear() {
      clearStatement.run();
    },
  };
}
