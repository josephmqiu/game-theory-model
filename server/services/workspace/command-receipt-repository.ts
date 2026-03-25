import type { DatabaseSync } from "node:sqlite";
import type {
  CommandReceipt,
  CommandReceiptStore,
  CommandErrorInfo,
} from "../command-bus";

function toNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseJson<T>(value: string | null): T | undefined {
  if (value === null) {
    return undefined;
  }

  return JSON.parse(value) as T;
}

function mapRow(row: Record<string, unknown>): CommandReceipt {
  const result = parseJson<unknown>(toNullableText(row.result_json));
  const error = parseJson<CommandErrorInfo>(toNullableText(row.error_json));

  return {
    commandId: String(row.command_id),
    receiptId: toNullableText(row.receipt_id) ?? undefined,
    workspaceId: toNullableText(row.workspace_id) ?? undefined,
    threadId: toNullableText(row.thread_id) ?? undefined,
    runId: toNullableText(row.run_id) ?? undefined,
    kind: String(row.kind) as CommandReceipt["kind"],
    status: String(row.status) as CommandReceipt["status"],
    payloadFingerprint: String(row.payload_fingerprint),
    submittedAt: Number(row.submitted_at),
    acceptedAt: Number(row.accepted_at),
    startedAt: row.started_at === null ? undefined : Number(row.started_at),
    finishedAt: row.finished_at === null ? undefined : Number(row.finished_at),
    duplicateOfCommandId:
      toNullableText(row.duplicate_of_command_id) ?? undefined,
    conflictWithCommandId:
      toNullableText(row.conflict_with_command_id) ?? undefined,
    requestedBy: String(row.requested_by),
    correlationId: toNullableText(row.correlation_id) ?? undefined,
    causationId: toNullableText(row.causation_id) ?? undefined,
    ...(result !== undefined ? { result } : {}),
    ...(error ? { error } : {}),
  };
}

function serializeReceipt(
  receipt: CommandReceipt,
): Record<string, null | number | bigint | string | NodeJS.ArrayBufferView> {
  return {
    $commandId: receipt.commandId,
    $receiptId: receipt.receiptId ?? null,
    $workspaceId: receipt.workspaceId ?? null,
    $threadId: receipt.threadId ?? null,
    $runId: receipt.runId ?? null,
    $kind: receipt.kind,
    $status: receipt.status,
    $payloadFingerprint: receipt.payloadFingerprint,
    $submittedAt: receipt.submittedAt,
    $acceptedAt: receipt.acceptedAt,
    $startedAt: receipt.startedAt ?? null,
    $finishedAt: receipt.finishedAt ?? null,
    $duplicateOfCommandId: receipt.duplicateOfCommandId ?? null,
    $conflictWithCommandId: receipt.conflictWithCommandId ?? null,
    $requestedBy: receipt.requestedBy,
    $correlationId: receipt.correlationId ?? null,
    $causationId: receipt.causationId ?? null,
    $resultJson:
      receipt.result === undefined ? null : JSON.stringify(receipt.result),
    $errorJson:
      receipt.error === undefined ? null : JSON.stringify(receipt.error),
  };
}

export function createSqliteCommandReceiptStore(
  db: DatabaseSync,
): CommandReceiptStore {
  const getByCommandIdStatement = db.prepare(
    `SELECT command_id, receipt_id, workspace_id, thread_id, run_id, kind, status, payload_fingerprint, submitted_at, accepted_at, started_at, finished_at, duplicate_of_command_id, conflict_with_command_id, requested_by, correlation_id, causation_id, result_json, error_json
     FROM command_receipts
     WHERE command_id = $commandId
     LIMIT 1`,
  );
  const getByReceiptIdStatement = db.prepare(
    `SELECT command_id, receipt_id, workspace_id, thread_id, run_id, kind, status, payload_fingerprint, submitted_at, accepted_at, started_at, finished_at, duplicate_of_command_id, conflict_with_command_id, requested_by, correlation_id, causation_id, result_json, error_json
     FROM command_receipts
     WHERE receipt_id = $receiptId
     ORDER BY accepted_at ASC, command_id ASC
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT command_id, receipt_id, workspace_id, thread_id, run_id, kind, status, payload_fingerprint, submitted_at, accepted_at, started_at, finished_at, duplicate_of_command_id, conflict_with_command_id, requested_by, correlation_id, causation_id, result_json, error_json
     FROM command_receipts
     ORDER BY accepted_at ASC, command_id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO command_receipts (
       command_id, receipt_id, workspace_id, thread_id, run_id, kind, status,
       payload_fingerprint, submitted_at, accepted_at, started_at, finished_at,
       duplicate_of_command_id, conflict_with_command_id, requested_by,
       correlation_id, causation_id, result_json, error_json
     ) VALUES (
       $commandId, $receiptId, $workspaceId, $threadId, $runId, $kind, $status,
       $payloadFingerprint, $submittedAt, $acceptedAt, $startedAt, $finishedAt,
       $duplicateOfCommandId, $conflictWithCommandId, $requestedBy,
       $correlationId, $causationId, $resultJson, $errorJson
     )
     ON CONFLICT(command_id) DO UPDATE SET
       receipt_id = excluded.receipt_id,
       workspace_id = excluded.workspace_id,
       thread_id = excluded.thread_id,
       run_id = excluded.run_id,
       kind = excluded.kind,
       status = excluded.status,
       payload_fingerprint = excluded.payload_fingerprint,
       submitted_at = excluded.submitted_at,
       accepted_at = excluded.accepted_at,
       started_at = excluded.started_at,
       finished_at = excluded.finished_at,
       duplicate_of_command_id = excluded.duplicate_of_command_id,
       conflict_with_command_id = excluded.conflict_with_command_id,
       requested_by = excluded.requested_by,
       correlation_id = excluded.correlation_id,
       causation_id = excluded.causation_id,
       result_json = excluded.result_json,
       error_json = excluded.error_json`,
  );
  const clearStatement = db.prepare(`DELETE FROM command_receipts`);

  function getByCommandId(commandId: string): CommandReceipt | undefined {
    const row = getByCommandIdStatement.get({ $commandId: commandId });
    return row ? mapRow(row) : undefined;
  }

  function getByReceiptId(receiptId: string): CommandReceipt | undefined {
    const row = getByReceiptIdStatement.get({ $receiptId: receiptId });
    return row ? mapRow(row) : undefined;
  }

  return {
    getByCommandId,
    getByReceiptId,
    save(receipt) {
      upsertStatement.run(serializeReceipt(receipt));
    },
    list() {
      return listStatement.all().map((row) => mapRow(row));
    },
    clear() {
      clearStatement.run();
    },
  };
}

export function createCommandReceiptStoreProxy(
  resolveStore: () => CommandReceiptStore,
): CommandReceiptStore {
  return {
    getByCommandId(commandId: string) {
      return resolveStore().getByCommandId(commandId);
    },
    getByReceiptId(receiptId: string) {
      return resolveStore().getByReceiptId(receiptId);
    },
    save(receipt: CommandReceipt) {
      resolveStore().save(receipt);
    },
    list() {
      return resolveStore().list();
    },
    clear() {
      resolveStore().clear();
    },
  };
}
