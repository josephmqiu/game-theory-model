// transport/entity-graph-ws-adapter.ts
// Thin adapter that listens to WebSocket push events and maps them to
// entity-graph-store mutations. No business logic lives here.
//
// Usage: call `bindEntityGraphAdapter()` once at app startup after
// `initWsTransport()`. Returns an unbind function for cleanup.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  ANALYSIS_CHANNELS,
  getWsTransport,
  type AnalysisEntityCreatedPayload,
  type AnalysisEntityUpdatedPayload,
  type AnalysisEntityDeletedPayload,
  type AnalysisRelationshipCreatedPayload,
  type AnalysisRelationshipDeletedPayload,
  type AnalysisRolledBackPayload,
} from "./ws-client";

/**
 * Bind WebSocket push channels to entity-graph-store mutations.
 * Returns a cleanup function that removes all subscriptions.
 */
export function bindEntityGraphAdapter(): () => void {
  const transport = getWsTransport();
  const unsubs: Array<() => void> = [];

  // ── Entity created ─────────────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.entityCreated,
      (data: AnalysisEntityCreatedPayload) => {
        useEntityGraphStore.getState().upsertEntityFromServer(data.entity);
      },
    ),
  );

  // ── Entity updated ─────────────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.entityUpdated,
      (data: AnalysisEntityUpdatedPayload) => {
        useEntityGraphStore.getState().upsertEntityFromServer(data.entity);
      },
    ),
  );

  // ── Entity deleted ─────────────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.entityDeleted,
      (data: AnalysisEntityDeletedPayload) => {
        useEntityGraphStore.getState().removeEntityFromServer(data.entityId);
      },
    ),
  );

  // ── Relationship created ───────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.relationshipCreated,
      (data: AnalysisRelationshipCreatedPayload) => {
        useEntityGraphStore
          .getState()
          .upsertRelationshipFromServer(data.relationship);
      },
    ),
  );

  // ── Relationship deleted ───────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.relationshipDeleted,
      (data: AnalysisRelationshipDeletedPayload) => {
        useEntityGraphStore
          .getState()
          .removeRelationshipFromServer(data.relationshipId);
      },
    ),
  );

  // ── Rollback (batch remove entities + relationships) ───────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.rolledBack,
      (data: AnalysisRolledBackPayload) => {
        const store = useEntityGraphStore.getState();

        // Remove entities in batch
        for (const entityId of data.entityIds) {
          store.removeEntityFromServer(entityId);
        }

        // Remove relationships in batch
        for (const relId of data.relationshipIds) {
          store.removeRelationshipFromServer(relId);
        }
      },
    ),
  );

  // ── Cleanup ────────────────────────────────────────────────────────
  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
