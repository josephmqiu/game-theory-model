import type { DatabaseSync } from "node:sqlite";
import type { RunState } from "../../../shared/types/workspace-state";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";

export interface RunRepository {
  getRunState(id: string): RunState | undefined;
  listRunsByThreadId(threadId: string): RunState[];
  upsertRunState(run: RunState): RunState;
  clear(): void;
}

function mapRunRow(row: Record<string, unknown>): RunState {
  return parseJsonColumn<RunState>(row.run_json, "runs.run_json");
}

export function createRunRepository(db: DatabaseSync): RunRepository {
  const getStatement = db.prepare(
    `SELECT run_json
     FROM runs
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT run_json
     FROM runs
     WHERE thread_id = $threadId
     ORDER BY updated_at DESC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO runs (
       id,
       workspace_id,
       thread_id,
       provider,
       model,
       effort,
       run_kind,
       status,
       active_phase,
       progress_completed,
       progress_total,
       failure_json,
       latest_activity_at,
       latest_activity_kind,
       latest_activity_message,
       run_json,
       started_at,
       finished_at,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $threadId,
       $provider,
       $model,
       $effort,
       $runKind,
       $status,
       $activePhase,
       $progressCompleted,
       $progressTotal,
       $failureJson,
       $latestActivityAt,
       $latestActivityKind,
       $latestActivityMessage,
       $runJson,
       $startedAt,
       $finishedAt,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       provider = excluded.provider,
       model = excluded.model,
       effort = excluded.effort,
       run_kind = excluded.run_kind,
       status = excluded.status,
       active_phase = excluded.active_phase,
       progress_completed = excluded.progress_completed,
       progress_total = excluded.progress_total,
       failure_json = excluded.failure_json,
       latest_activity_at = excluded.latest_activity_at,
       latest_activity_kind = excluded.latest_activity_kind,
       latest_activity_message = excluded.latest_activity_message,
       run_json = excluded.run_json,
       started_at = excluded.started_at,
       finished_at = excluded.finished_at,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM runs`);

  return {
    getRunState(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapRunRow(row) : undefined;
    },
    listRunsByThreadId(threadId) {
      return listStatement
        .all({ $threadId: threadId })
        .map((row) => mapRunRow(row));
    },
    upsertRunState(run) {
      upsertStatement.run({
        $id: run.id,
        $workspaceId: run.workspaceId,
        $threadId: run.threadId,
        $provider: run.provider,
        $model: run.model,
        $effort: run.effort,
        $runKind: run.kind,
        $status: run.status,
        $activePhase: run.activePhase ?? null,
        $progressCompleted: run.progress.completed,
        $progressTotal: run.progress.total,
        $failureJson:
          run.failure === undefined ? null : stringifyJson(run.failure),
        $latestActivityAt: run.latestActivityAt ?? null,
        $latestActivityKind: run.latestActivity?.kind ?? null,
        $latestActivityMessage: run.latestActivity?.message ?? null,
        $runJson: stringifyJson(run),
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
