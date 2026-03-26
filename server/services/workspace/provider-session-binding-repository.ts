import type { DatabaseSync } from "node:sqlite";
import type {
  ProviderSessionBindingPurpose,
  ProviderSessionBindingRecord,
} from "./workspace-types";

export interface ProviderSessionBindingRepository {
  getBinding(
    threadId: string,
    purpose?: ProviderSessionBindingPurpose,
  ): ProviderSessionBindingRecord | undefined;
  listBindingsByWorkspaceId(
    workspaceId: string,
  ): ProviderSessionBindingRecord[];
  upsertBinding(
    binding: ProviderSessionBindingRecord,
  ): ProviderSessionBindingRecord;
  deleteBinding(
    threadId: string,
    purpose?: ProviderSessionBindingPurpose,
  ): void;
  clear(): void;
}

function mapBindingRow(
  row: Record<string, unknown>,
): ProviderSessionBindingRecord {
  return {
    threadId: String(row.thread_id),
    purpose: String(row.purpose) as ProviderSessionBindingPurpose,
    workspaceId: String(row.workspace_id),
    provider: String(row.provider),
    providerSessionId: String(row.provider_session_id),
    phaseTurnId: row.phase_turn_id === null ? null : String(row.phase_turn_id),
    runId: row.run_id === null ? null : String(row.run_id),
    bindingJson: String(row.binding_json),
    updatedAt: Number(row.updated_at),
  };
}

export function createProviderSessionBindingRepository(
  db: DatabaseSync,
): ProviderSessionBindingRepository {
  const getStatement = db.prepare(
    `SELECT thread_id, purpose, workspace_id, provider, provider_session_id, phase_turn_id, run_id, binding_json, updated_at
     FROM provider_session_bindings
     WHERE thread_id = $threadId
       AND purpose = $purpose
     LIMIT 1`,
  );
  const listStatement = db.prepare(
    `SELECT thread_id, purpose, workspace_id, provider, provider_session_id, phase_turn_id, run_id, binding_json, updated_at
     FROM provider_session_bindings
     WHERE workspace_id = $workspaceId
     ORDER BY updated_at DESC, thread_id ASC, purpose ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO provider_session_bindings (
       thread_id, purpose, workspace_id, provider, provider_session_id, phase_turn_id, run_id, binding_json, updated_at
     ) VALUES (
       $threadId, $purpose, $workspaceId, $provider, $providerSessionId, $phaseTurnId, $runId, $bindingJson, $updatedAt
     )
     ON CONFLICT(thread_id, purpose) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       provider = excluded.provider,
       provider_session_id = excluded.provider_session_id,
       phase_turn_id = excluded.phase_turn_id,
       run_id = excluded.run_id,
       binding_json = excluded.binding_json,
       updated_at = excluded.updated_at`,
  );
  const deleteStatement = db.prepare(
    `DELETE FROM provider_session_bindings
     WHERE thread_id = $threadId
       AND ($purpose IS NULL OR purpose = $purpose)`,
  );
  const clearStatement = db.prepare(`DELETE FROM provider_session_bindings`);

  return {
    getBinding(threadId, purpose = "chat") {
      const row = getStatement.get({
        $threadId: threadId,
        $purpose: purpose,
      });
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
        $purpose: binding.purpose,
        $workspaceId: binding.workspaceId,
        $provider: binding.provider,
        $providerSessionId: binding.providerSessionId,
        $phaseTurnId: binding.phaseTurnId,
        $runId: binding.runId,
        $bindingJson: binding.bindingJson,
        $updatedAt: binding.updatedAt,
      });

      const stored = getStatement.get({
        $threadId: binding.threadId,
        $purpose: binding.purpose,
      });
      if (!stored) {
        throw new Error(
          `Failed to persist provider session binding for thread "${binding.threadId}" with purpose "${binding.purpose}".`,
        );
      }
      return mapBindingRow(stored);
    },
    deleteBinding(threadId, purpose) {
      deleteStatement.run({
        $threadId: threadId,
        $purpose: purpose ?? null,
      });
    },
    clear() {
      clearStatement.run();
    },
  };
}
