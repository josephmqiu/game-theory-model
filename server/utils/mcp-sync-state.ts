/**
 * In-memory sync state for MCP ↔ Renderer real-time communication.
 * Adapted from OpenPencil's passive cache pattern.
 *
 * The renderer is authoritative. Nitro holds a synced cache.
 * MCP tools read from this cache. MCP writes go through SSE → renderer → back.
 */

import type { ServerResponse } from "node:http";
import type { CanonicalStore } from "shared/game-theory/types/canonical";

export interface PipelineStateSnapshot {
  analysis_state: unknown;
  phase_results: Record<number, unknown>;
}

export interface PipelineRuntimeSnapshot {
  prompt_registry: unknown;
  active_rerun_cycle: unknown;
  pending_revalidation_approvals: Record<string, unknown>;
}

export interface ConversationStateSnapshot {
  messages: unknown[];
  proposal_review: unknown;
  proposals_by_id: Record<string, unknown>;
}

export interface SyncState {
  canonical: CanonicalStore | null;
  pipelineState: PipelineStateSnapshot | null;
  runtimeState: PipelineRuntimeSnapshot | null;
  conversationState: ConversationStateSnapshot | null;
}

interface SSEClient {
  id: string;
  res: ServerResponse;
}

let currentState: SyncState = {
  canonical: null,
  pipelineState: null,
  runtimeState: null,
  conversationState: null,
};
let stateVersion = 0;

const clients = new Map<string, SSEClient>();

export function getSyncState(): { state: SyncState; version: number } {
  return { state: currentState, version: stateVersion };
}

export function setSyncState(
  state: Partial<SyncState>,
  sourceClientId?: string,
): number {
  currentState = { ...currentState, ...state };
  stateVersion++;
  broadcast(
    { type: "state:update", version: stateVersion, state: currentState },
    sourceClientId,
  );
  return stateVersion;
}

export function getSyncCanonical(): CanonicalStore | null {
  return currentState.canonical;
}

export function registerSSEClient(id: string, res: ServerResponse): void {
  clients.set(id, { id, res });
}

export function unregisterSSEClient(id: string): void {
  clients.delete(id);
}

function broadcast(
  payload: Record<string, unknown>,
  excludeClientId?: string,
): void {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [id, client] of clients) {
    if (id === excludeClientId) continue;
    try {
      if (!client.res.closed) client.res.write(data);
    } catch {
      clients.delete(id);
    }
  }
}
