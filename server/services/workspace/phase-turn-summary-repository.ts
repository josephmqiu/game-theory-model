import type { DatabaseSync } from "node:sqlite";
import type { PhaseTurnSummaryState } from "../../../shared/types/workspace-state";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";
import type { MethodologyPhase } from "../../../shared/types/methodology";

export interface PhaseTurnSummaryRepository {
  getLatestPhaseTurnByRunAndPhase(
    runId: string,
    phase: MethodologyPhase,
  ): PhaseTurnSummaryState | undefined;
  listPhaseTurnSummariesByRunId(runId: string): PhaseTurnSummaryState[];
  upsertPhaseTurnSummary(
    phaseTurn: PhaseTurnSummaryState,
  ): PhaseTurnSummaryState;
  clear(): void;
}

function mapPhaseTurnRow(row: Record<string, unknown>): PhaseTurnSummaryState {
  return parseJsonColumn<PhaseTurnSummaryState>(
    row.phase_turn_json,
    "phase_turn_summaries.phase_turn_json",
  );
}

export function createPhaseTurnSummaryRepository(
  db: DatabaseSync,
): PhaseTurnSummaryRepository {
  const getLatestStatement = db.prepare(
    `SELECT phase_turn_json
     FROM phase_turn_summaries
     WHERE run_id = $runId
       AND phase = $phase
     ORDER BY turn_index DESC
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT phase_turn_json
     FROM phase_turn_summaries
     WHERE run_id = $runId
     ORDER BY phase ASC, turn_index ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO phase_turn_summaries (
       id,
       workspace_id,
       thread_id,
       run_id,
       phase,
       turn_index,
       status,
       started_at,
       completed_at,
       last_event_id,
       failure_json,
       phase_turn_json,
       created_at,
       updated_at
     ) VALUES (
       $id,
       $workspaceId,
       $threadId,
       $runId,
       $phase,
       $turnIndex,
       $status,
       $startedAt,
       $completedAt,
       $lastEventId,
       $failureJson,
       $phaseTurnJson,
       $createdAt,
       $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       run_id = excluded.run_id,
       phase = excluded.phase,
       turn_index = excluded.turn_index,
       status = excluded.status,
       started_at = excluded.started_at,
       completed_at = excluded.completed_at,
       last_event_id = excluded.last_event_id,
       failure_json = excluded.failure_json,
       phase_turn_json = excluded.phase_turn_json,
       updated_at = excluded.updated_at`,
  );
  const getByIdStatement = db.prepare(
    `SELECT phase_turn_json
     FROM phase_turn_summaries
     WHERE id = $id`,
  );
  const clearStatement = db.prepare(`DELETE FROM phase_turn_summaries`);

  return {
    getLatestPhaseTurnByRunAndPhase(runId, phase) {
      const row = getLatestStatement.get({
        $runId: runId,
        $phase: phase,
      });
      return row ? mapPhaseTurnRow(row) : undefined;
    },
    listPhaseTurnSummariesByRunId(runId) {
      return listStatement
        .all({ $runId: runId })
        .map((row) => mapPhaseTurnRow(row));
    },
    upsertPhaseTurnSummary(phaseTurn) {
      upsertStatement.run({
        $id: phaseTurn.id,
        $workspaceId: phaseTurn.workspaceId,
        $threadId: phaseTurn.threadId,
        $runId: phaseTurn.runId,
        $phase: phaseTurn.phase,
        $turnIndex: phaseTurn.turnIndex,
        $status: phaseTurn.status,
        $startedAt: phaseTurn.startedAt,
        $completedAt: phaseTurn.completedAt,
        $lastEventId: phaseTurn.lastEventId,
        $failureJson:
          phaseTurn.failure === undefined
            ? null
            : stringifyJson(phaseTurn.failure),
        $phaseTurnJson: stringifyJson(phaseTurn),
        $createdAt: phaseTurn.createdAt,
        $updatedAt: phaseTurn.updatedAt,
      });

      const stored = getByIdStatement.get({ $id: phaseTurn.id });
      if (!stored) {
        throw new Error(
          `Failed to persist phase turn "${phaseTurn.id}" for run "${phaseTurn.runId}".`,
        );
      }
      return mapPhaseTurnRow(stored);
    },
    clear() {
      clearStatement.run();
    },
  };
}
