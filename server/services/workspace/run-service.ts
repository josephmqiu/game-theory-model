import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
} from "../../../shared/types/workspace-state";
import { getRunLogPath } from "../../utils/ai-logger";
import type { AnyDomainEvent } from "./domain-event-types";
import type { WorkspaceDatabase } from "./workspace-db";
import { getWorkspaceDatabase } from "./workspace-db";

export interface RunDetail {
  run: RunState;
  phaseTurns: PhaseTurnSummaryState[];
  activities: ActivityEntry[];
  domainEvents: AnyDomainEvent[];
  jsonlLogPath: string;
}

export function createRunService(
  database: WorkspaceDatabase = getWorkspaceDatabase(),
) {
  return {
    getRunDetailById(runId: string): RunDetail | undefined {
      const run = database.runs.getRunState(runId);
      if (!run) {
        return undefined;
      }

      return {
        run,
        phaseTurns: database.phaseTurnSummaries.listPhaseTurnSummariesByRunId(
          runId,
        ),
        activities: database.activities.listActivitiesByRunId(runId),
        domainEvents: database.domainEvents.listEventsByRunId(runId),
        jsonlLogPath: getRunLogPath(runId),
      };
    },
  };
}
