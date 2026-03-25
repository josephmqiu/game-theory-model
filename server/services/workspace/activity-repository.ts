import type { DatabaseSync } from "node:sqlite";
import type { ActivityRecord } from "./workspace-types";

export interface ActivityRepository {
  upsertActivity(activity: ActivityRecord): ActivityRecord;
  getActivity(id: string): ActivityRecord | undefined;
  listActivitiesByRunId(runId: string): ActivityRecord[];
  clear(): void;
}

function mapActivityRow(row: Record<string, unknown>): ActivityRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    threadId: String(row.thread_id),
    runId: row.run_id === null ? null : String(row.run_id),
    kind: String(row.kind),
    activityJson: String(row.activity_json),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function createActivityRepository(db: DatabaseSync): ActivityRepository {
  const getStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, run_id, kind, activity_json, created_at, updated_at
     FROM activities
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT id, workspace_id, thread_id, run_id, kind, activity_json, created_at, updated_at
     FROM activities
     WHERE run_id = $runId
     ORDER BY created_at ASC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO activities (
       id, workspace_id, thread_id, run_id, kind, activity_json, created_at, updated_at
     ) VALUES (
       $id, $workspaceId, $threadId, $runId, $kind, $activityJson, $createdAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       run_id = excluded.run_id,
       kind = excluded.kind,
       activity_json = excluded.activity_json,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM activities`);

  return {
    upsertActivity(activity) {
      upsertStatement.run({
        $id: activity.id,
        $workspaceId: activity.workspaceId,
        $threadId: activity.threadId,
        $runId: activity.runId,
        $kind: activity.kind,
        $activityJson: activity.activityJson,
        $createdAt: activity.createdAt,
        $updatedAt: activity.updatedAt,
      });

      const stored = getStatement.get({ $id: activity.id });
      if (!stored) {
        throw new Error(`Failed to persist activity "${activity.id}".`);
      }
      return mapActivityRow(stored);
    },
    getActivity(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapActivityRow(row) : undefined;
    },
    listActivitiesByRunId(runId) {
      return listStatement
        .all({ $runId: runId })
        .map((row) => mapActivityRow(row));
    },
    clear() {
      clearStatement.run();
    },
  };
}
