import type { DatabaseSync } from "node:sqlite";
import type { ThreadState } from "../../../shared/types/workspace-state";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";

export interface ThreadRepository {
  getThreadState(id: string): ThreadState | undefined;
  listThreadsByWorkspaceId(workspaceId: string): ThreadState[];
  upsertThreadState(thread: ThreadState): ThreadState;
  deleteThreadState(id: string): void;
  clear(): void;
}

function mapThreadRow(row: Record<string, unknown>): ThreadState {
  return parseJsonColumn<ThreadState>(row.thread_json, "threads.thread_json");
}

export function createThreadRepository(db: DatabaseSync): ThreadRepository {
  const getStatement = db.prepare(
    `SELECT thread_json
     FROM threads
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT thread_json
     FROM threads
     WHERE workspace_id = $workspaceId
     ORDER BY updated_at DESC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO threads (
       id,
       workspace_id,
       title,
       is_primary,
       latest_run_id,
       latest_activity_at,
       latest_terminal_status,
       summary,
       thread_json,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $title,
       $isPrimary,
       $latestRunId,
       $latestActivityAt,
       $latestTerminalStatus,
       $summary,
       $threadJson,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       title = excluded.title,
       is_primary = excluded.is_primary,
       latest_run_id = excluded.latest_run_id,
       latest_activity_at = excluded.latest_activity_at,
       latest_terminal_status = excluded.latest_terminal_status,
       summary = excluded.summary,
       thread_json = excluded.thread_json,
       updated_at = excluded.updated_at`,
  );
  const deleteStatement = db.prepare(`DELETE FROM threads WHERE id = $id`);
  const clearStatement = db.prepare(`DELETE FROM threads`);

  return {
    getThreadState(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapThreadRow(row) : undefined;
    },
    listThreadsByWorkspaceId(workspaceId) {
      return listStatement
        .all({ $workspaceId: workspaceId })
        .map((row) => mapThreadRow(row));
    },
    upsertThreadState(thread) {
      upsertStatement.run({
        $id: thread.id,
        $workspaceId: thread.workspaceId,
        $title: thread.title,
        $isPrimary: thread.isPrimary ? 1 : 0,
        $latestRunId: thread.latestRunId ?? null,
        $latestActivityAt: thread.latestActivityAt ?? null,
        $latestTerminalStatus: thread.latestTerminalStatus ?? null,
        $summary: thread.summary ?? null,
        $threadJson: stringifyJson(thread),
        $createdAt: thread.createdAt,
        $updatedAt: thread.updatedAt,
      });

      const stored = getStatement.get({ $id: thread.id });
      if (!stored) {
        throw new Error(`Failed to persist thread "${thread.id}".`);
      }
      return mapThreadRow(stored);
    },
    deleteThreadState(id) {
      deleteStatement.run({ $id: id });
    },
    clear() {
      clearStatement.run();
    },
  };
}
