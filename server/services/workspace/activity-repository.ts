import type { DatabaseSync } from "node:sqlite";
import type { ActivityEntry } from "../../../shared/types/workspace-state";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";

export interface ActivityRepository {
  upsertActivityEntry(activity: ActivityEntry): ActivityEntry;
  getActivityEntry(id: string): ActivityEntry | undefined;
  listActivitiesByRunId(runId: string): ActivityEntry[];
  listActivitiesByThreadId(threadId: string): ActivityEntry[];
  clear(): void;
}

function mapActivityRow(row: Record<string, unknown>): ActivityEntry {
  return parseJsonColumn<ActivityEntry>(
    row.activity_json,
    "activities.activity_json",
  );
}

export function createActivityRepository(db: DatabaseSync): ActivityRepository {
  const getStatement = db.prepare(
    `SELECT activity_json
     FROM activities
     WHERE id = $id
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT activity_json
     FROM activities
     WHERE run_id = $runId
     ORDER BY event_sequence ASC, id ASC`,
  );
  const listByThreadStatement = db.prepare(
    `SELECT activity_json
     FROM activities
     WHERE thread_id = $threadId
     ORDER BY occurred_at ASC, event_sequence ASC, id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO activities (
       id,
       workspace_id,
       thread_id,
       run_id,
       phase,
       kind,
       event_sequence,
       caused_by_event_id,
       occurred_at,
       activity_json,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $threadId,
       $runId,
       $phase,
       $kind,
       $eventSequence,
       $causedByEventId,
       $occurredAt,
       $activityJson,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       run_id = excluded.run_id,
       phase = excluded.phase,
       kind = excluded.kind,
       event_sequence = excluded.event_sequence,
       caused_by_event_id = excluded.caused_by_event_id,
       occurred_at = excluded.occurred_at,
       activity_json = excluded.activity_json,
       updated_at = excluded.updated_at`,
  );
  const clearStatement = db.prepare(`DELETE FROM activities`);

  return {
    upsertActivityEntry(activity) {
      upsertStatement.run({
        $id: activity.id,
        $workspaceId: activity.workspaceId,
        $threadId: activity.threadId,
        $runId: activity.runId ?? null,
        $phase: activity.phase ?? null,
        $kind: activity.kind,
        $eventSequence: activity.sequence,
        $causedByEventId: activity.causedByEventId ?? null,
        $occurredAt: activity.occurredAt,
        $activityJson: stringifyJson(activity),
        $createdAt: activity.occurredAt,
        $updatedAt: activity.occurredAt,
      });

      const stored = getStatement.get({ $id: activity.id });
      if (!stored) {
        throw new Error(`Failed to persist activity "${activity.id}".`);
      }
      return mapActivityRow(stored);
    },
    getActivityEntry(id) {
      const row = getStatement.get({ $id: id });
      return row ? mapActivityRow(row) : undefined;
    },
    listActivitiesByRunId(runId) {
      return listStatement
        .all({ $runId: runId })
        .map((row) => mapActivityRow(row));
    },
    listActivitiesByThreadId(threadId) {
      return listByThreadStatement
        .all({ $threadId: threadId })
        .map((row) => mapActivityRow(row));
    },
    clear() {
      clearStatement.run();
    },
  };
}
