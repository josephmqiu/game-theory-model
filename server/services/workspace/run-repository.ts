import type { DatabaseSync } from "node:sqlite";
import type { RunRecord } from "./workspace-types";

export interface RunRepository {
  getRun(id: string): RunRecord | undefined;
  listRunsByThreadId(threadId: string): RunRecord[];
  upsertRun(run: RunRecord): RunRecord;
  clear(): void;
}

function mapRunRow(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    threadId: String(row.thread_id),
    provider: row.provider === null ? null : String(row.provider),
    model: row.model === null ? null : String(row.model),
    effort: row.effort === null ? null : String(row.effort),
    status: String(row.status),
    runJson: String(row.run_json),
    startedAt: Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function createRunRepository(db: DatabaseSync): RunRepository {
  const getStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, provider, model, effort, status, run_json, started_at, finished_at, created_at, updated_at
     FROM runs
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, provider, model, effort, status, run_json, started_at, finished_at, created_at, updated_at
     FROM runs
     WHERE thread_id = $threadId
     ORDER BY updated_at DESC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO runs (
       id, workspace_id, thread_id, provider, model, effort, status,
       run_json, started_at, finished_at, created_at, updated_at
     ) VALUES (
       $id, $workspaceId, $threadId, $provider, $model, $effort, $status,
       $runJson, $startedAt, $finishedAt, $createdAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       provider = excluded.provider,
       model = excluded.model,
       effort = excluded.effort,
       status = excluded.status,
       run_json = excluded.run_json,
       started_at = excluded.started_at,
       finished_at = excluded.finished_at,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM runs`);

  return {
    getRun(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapRunRow(row) : undefined;
    },
    listRunsByThreadId(threadId) {
      return listStatement
        .all({ $threadId: threadId })
        .map((row) => mapRunRow(row));
    },
    upsertRun(run) {
      upsertStatement.run({
        $id: run.id,
        $workspaceId: run.workspaceId,
        $threadId: run.threadId,
        $provider: run.provider,
        $model: run.model,
        $effort: run.effort,
        $status: run.status,
        $runJson: run.runJson,
        $startedAt: run.startedAt,
        $finishedAt: run.finishedAt,
        $createdAt: run.createdAt,
        $updatedAt: run.updatedAt,
      });

      const stored = getStatement.get({ $id: run.id });
      if (!stored) {
        throw new Error(`Failed to persist run "${run.id}".`);
      }
      return mapRunRow(stored);
    },
    clear() {
      clearStatement.run();
    },
  };
}
