import type { DatabaseSync } from "node:sqlite";
import type { ProviderSessionBindingRecord } from "./workspace-types";

export interface ProviderSessionBindingRepository {
  getBinding(threadId: string): ProviderSessionBindingRecord | undefined;
  listBindingsByWorkspaceId(
    workspaceId: string,
  ): ProviderSessionBindingRecord[];
  upsertBinding(
    binding: ProviderSessionBindingRecord,
  ): ProviderSessionBindingRecord;
  deleteBinding(threadId: string): void;
  clear(): void;
}

function mapBindingRow(
  row: Record<string, unknown>,
): ProviderSessionBindingRecord {
  return {
    threadId: String(row.thread_id),
    workspaceId: String(row.workspace_id),
    provider: String(row.provider),
    providerSessionId: String(row.provider_session_id),
    runId: row.run_id === null ? null : String(row.run_id),
    bindingJson: String(row.binding_json),
    updatedAt: Number(row.updated_at),
  };
}

export function createProviderSessionBindingRepository(
  db: DatabaseSync,
): ProviderSessionBindingRepository {
  const getStatement = db.prepare(
    `SELECT thread_id, workspace_id, provider, provider_session_id, run_id, binding_json, updated_at
     FROM provider_session_bindings
     WHERE thread_id = $threadId
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT thread_id, workspace_id, provider, provider_session_id, run_id, binding_json, updated_at
     FROM provider_session_bindings
     WHERE workspace_id = $workspaceId
     ORDER BY updated_at DESC, thread_id ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO provider_session_bindings (
       thread_id, workspace_id, provider, provider_session_id, run_id, binding_json, updated_at
     ) VALUES (
       $threadId, $workspaceId, $provider, $providerSessionId, $runId, $bindingJson, $updatedAt
     )
     ON CONFLICT(thread_id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       provider = excluded.provider,
       provider_session_id = excluded.provider_session_id,
       run_id = excluded.run_id,
       binding_json = excluded.binding_json,
       updated_at = excluded.updated_at`,
  );
  const deleteStatement = db.prepare(
    `DELETE FROM provider_session_bindings WHERE thread_id = $threadId`,
  );
  const clearStatement = db.prepare(`DELETE FROM provider_session_bindings`);

  return {
    getBinding(threadId) {
      const row = getStatement.get({ $threadId: threadId });
      return row ? mapBindingRow(row) : undefined;
    },
    listBindingsByWorkspaceId(workspaceId) {
      return listStatement
        .all({ $workspaceId: workspaceId })
        .map((row) => mapBindingRow(row));
    },
    upsertBinding(binding) {
      upsertStatement.run({
        $threadId: binding.threadId,
        $workspaceId: binding.workspaceId,
        $provider: binding.provider,
        $providerSessionId: binding.providerSessionId,
        $runId: binding.runId,
        $bindingJson: binding.bindingJson,
        $updatedAt: binding.updatedAt,
      });

      const stored = getStatement.get({ $threadId: binding.threadId });
      if (!stored) {
        throw new Error(
          `Failed to persist provider session binding for thread "${binding.threadId}".`,
        );
      }
      return mapBindingRow(stored);
    },
    deleteBinding(threadId) {
      deleteStatement.run({ $threadId: threadId });
    },
    clear() {
      clearStatement.run();
    },
  };
}
