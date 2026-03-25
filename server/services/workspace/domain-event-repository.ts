import type { DatabaseSync } from "node:sqlite";
import { parseJsonColumn } from "./sqlite-json";
import type {
  AnyDomainEvent,
  DomainEventRecord,
  DomainEventType,
} from "./domain-event-types";

export interface DomainEventRepository {
  getLastEventByRunId(runId: string): AnyDomainEvent | undefined;
  listEventsByRunId(runId: string): AnyDomainEvent[];
  insertRecord(record: Omit<DomainEventRecord, "sequence">): AnyDomainEvent;
  clear(): void;
}

function mapDomainEventRow(row: Record<string, unknown>): AnyDomainEvent {
  return {
    id: String(row.id),
    sequence: Number(row.sequence),
    workspaceId: String(row.workspace_id),
    threadId: String(row.thread_id),
    runId: row.run_id === null ? undefined : String(row.run_id),
    type: String(row.event_type) as DomainEventType,
    payload: parseJsonColumn(row.payload_json, "domain_events.payload_json"),
    occurredAt: Number(row.occurred_at),
    recordedAt: Number(row.recorded_at),
    commandId: row.command_id === null ? undefined : String(row.command_id),
    receiptId: row.receipt_id === null ? undefined : String(row.receipt_id),
    correlationId:
      row.correlation_id === null ? undefined : String(row.correlation_id),
    causationId:
      row.causation_id === null ? undefined : String(row.causation_id),
    causedByEventId:
      row.caused_by_event_id === null
        ? undefined
        : String(row.caused_by_event_id),
    producer: String(row.producer),
    schemaVersion: Number(row.schema_version),
  } as AnyDomainEvent;
}

export function createDomainEventRepository(
  db: DatabaseSync,
): DomainEventRepository {
  const getLastByRunIdStatement = db.prepare(
    `SELECT sequence, id, workspace_id, thread_id, run_id, event_type, payload_json, occurred_at, recorded_at, command_id, receipt_id, correlation_id, causation_id, caused_by_event_id, producer, schema_version
     FROM domain_events
     WHERE run_id = $runId
     ORDER BY sequence DESC
     LIMIT 1`,
  );
  const listByRunIdStatement = db.prepare(
    `SELECT sequence, id, workspace_id, thread_id, run_id, event_type, payload_json, occurred_at, recorded_at, command_id, receipt_id, correlation_id, causation_id, caused_by_event_id, producer, schema_version
     FROM domain_events
     WHERE run_id = $runId
     ORDER BY sequence ASC`,
  );
  const insertStatement = db.prepare(
    `INSERT INTO domain_events (
       id,
       workspace_id,
       thread_id,
       run_id,
       event_type,
       payload_json,
       occurred_at,
       recorded_at,
       command_id,
       receipt_id,
       correlation_id,
       causation_id,
       caused_by_event_id,
       producer,
       schema_version
     ) VALUES (
       $id,
       $workspaceId,
       $threadId,
       $runId,
       $eventType,
       $payloadJson,
       $occurredAt,
       $recordedAt,
       $commandId,
       $receiptId,
       $correlationId,
       $causationId,
       $causedByEventId,
       $producer,
       $schemaVersion
     )`,
  );
  const getByIdStatement = db.prepare(
    `SELECT sequence, id, workspace_id, thread_id, run_id, event_type, payload_json, occurred_at, recorded_at, command_id, receipt_id, correlation_id, causation_id, caused_by_event_id, producer, schema_version
     FROM domain_events
     WHERE id = $id
     LIMIT 1`,
  );
  const clearStatement = db.prepare(`DELETE FROM domain_events`);

  return {
    getLastEventByRunId(runId) {
      const row = getLastByRunIdStatement.get({ $runId: runId });
      return row ? mapDomainEventRow(row) : undefined;
    },
    listEventsByRunId(runId) {
      return listByRunIdStatement
        .all({ $runId: runId })
        .map((row) => mapDomainEventRow(row));
    },
    insertRecord(record) {
      insertStatement.run({
        $id: record.id,
        $workspaceId: record.workspaceId,
        $threadId: record.threadId,
        $runId: record.runId,
        $eventType: record.eventType,
        $payloadJson: record.payloadJson,
        $occurredAt: record.occurredAt,
        $recordedAt: record.recordedAt,
        $commandId: record.commandId,
        $receiptId: record.receiptId,
        $correlationId: record.correlationId,
        $causationId: record.causationId,
        $causedByEventId: record.causedByEventId,
        $producer: record.producer,
        $schemaVersion: record.schemaVersion,
      });

      const stored = getByIdStatement.get({ $id: record.id });
      if (!stored) {
        throw new Error(`Failed to persist domain event "${record.id}".`);
      }
      return mapDomainEventRow(stored);
    },
    clear() {
      clearStatement.run();
    },
  };
}
