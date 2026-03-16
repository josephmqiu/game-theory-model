import { beforeEach, describe, expect, it } from "vitest";

import { createSampleCanonicalStore } from "../test-support/sample-analysis";
import { dispatch, createEventLog, undo } from "./dispatch";
import {
  getCanonicalRevision,
  queryEvents,
  resetEventPersistenceAdapter,
  resetPersistedEventStore,
  setEventPersistenceAdapter,
} from "./event-persistence";

describe("stale propagation and audit persistence", () => {
  beforeEach(() => {
    resetEventPersistenceAdapter();
    resetPersistedEventStore();
  });

  function withoutFixtureStaleMarkers() {
    const store = createSampleCanonicalStore();

    for (const record of Object.values(store)) {
      for (const entity of Object.values(record)) {
        delete (entity as { stale_markers?: unknown }).stale_markers;
      }
    }

    return store;
  }

  it("propagates stale marks transitively and clears them by cause", () => {
    const store = withoutFixtureStaleMarkers();
    const markResult = dispatch(store, createEventLog("/analysis.gta.json"), {
      kind: "mark_stale",
      payload: {
        id: "source_1",
        reason: "Source updated",
      },
    });

    expect(markResult.status).toBe("committed");
    if (markResult.status !== "committed") {
      throw new Error("Expected mark_stale to commit.");
    }
    expect(
      markResult.store.sources.source_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "source_1",
      ),
    ).toBe(true);
    expect(
      markResult.store.observations.observation_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "source_1",
      ),
    ).toBe(true);
    expect(
      markResult.store.claims.claim_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "source_1",
      ),
    ).toBe(true);

    const withSecondCause = dispatch(markResult.store, markResult.event_log, {
      kind: "mark_stale",
      payload: {
        id: "claim_1",
        reason: "Claim revised",
      },
    });

    expect(withSecondCause.status).toBe("committed");
    if (withSecondCause.status !== "committed") {
      throw new Error("Expected second mark_stale to commit.");
    }

    const clearResult = dispatch(
      withSecondCause.store,
      withSecondCause.event_log,
      {
        kind: "clear_stale",
        payload: { id: "source_1" },
      },
    );

    expect(clearResult.status).toBe("committed");
    if (clearResult.status !== "committed") {
      throw new Error("Expected clear_stale to commit.");
    }

    expect(
      clearResult.store.observations.observation_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "source_1",
      ) ?? false,
    ).toBe(false);
    expect(
      clearResult.store.claims.claim_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "claim_1",
      ),
    ).toBe(true);

    const undone = undo(clearResult.store, clearResult.event_log);
    expect(
      undone?.store.claims.claim_1.stale_markers?.some(
        (marker) => marker.caused_by.id === "source_1",
      ),
    ).toBe(true);
  });

  it("deduplicates stale markers by cause even when the reason changes", () => {
    const store = withoutFixtureStaleMarkers();

    const first = dispatch(store, createEventLog("/analysis.gta.json"), {
      kind: "mark_stale",
      payload: {
        id: "source_1",
        reason: "Initial refresh",
      },
    });

    expect(first.status).toBe("committed");
    if (first.status !== "committed") {
      throw new Error("Expected first mark_stale to commit.");
    }

    const second = dispatch(first.store, first.event_log, {
      kind: "mark_stale",
      payload: {
        id: "source_1",
        reason: "Reworded refresh",
      },
    });

    expect(second.status).toBe("committed");
    if (second.status !== "committed") {
      throw new Error("Expected second mark_stale to commit.");
    }

    expect(
      second.store.sources.source_1.stale_markers?.filter(
        (marker) =>
          marker.caused_by.type === "source" &&
          marker.caused_by.id === "source_1",
      ),
    ).toHaveLength(1);
    expect(
      second.store.observations.observation_1.stale_markers?.filter(
        (marker) =>
          marker.caused_by.type === "source" &&
          marker.caused_by.id === "source_1",
      ),
    ).toHaveLength(1);
  });

  it("propagates stale through analytical refs without fanning out through structural containment", () => {
    const store = withoutFixtureStaleMarkers();

    const result = dispatch(store, createEventLog("/analysis.gta.json"), {
      kind: "mark_stale",
      payload: {
        id: "player_1",
        reason: "Player inputs changed",
      },
    });

    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("Expected mark_stale to commit.");
    }

    expect(result.store.players.player_1.stale_markers?.length).toBe(1);
    expect(result.store.games.game_1.stale_markers).toBeUndefined();
    expect(
      result.store.formalizations.formalization_1.stale_markers,
    ).toBeUndefined();
    expect(result.store.nodes.game_node_1.stale_markers).toBeUndefined();
    expect(result.store.edges.game_edge_1.stale_markers).toBeUndefined();
  });

  it("persists committed events, supports filtered queries, and keeps undo append-only", async () => {
    const store = createSampleCanonicalStore();
    const eventLog = createEventLog("/analysis.gta.json");

    const first = dispatch(store, eventLog, {
      kind: "add_claim",
      payload: {
        statement: "Persisted one",
        based_on: ["observation_1"],
        confidence: 0.4,
      },
    });
    expect(first.status).toBe("committed");
    if (first.status !== "committed") {
      throw new Error("Expected first command to commit.");
    }

    const second = dispatch(
      first.store,
      first.event_log,
      {
        kind: "mark_stale",
        payload: {
          id: "source_1",
          reason: "Refresh",
        },
      },
      { source: "solver" },
    );
    expect(second.status).toBe("committed");
    if (second.status !== "committed") {
      throw new Error("Expected second command to commit.");
    }

    const allEvents = await queryEvents("/analysis.gta.json");
    expect(allEvents).toHaveLength(2);

    const filtered = await queryEvents("/analysis.gta.json", {
      source: "solver",
      since: first.event.timestamp,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].source).toBe("solver");

    const revision = await getCanonicalRevision("/analysis.gta.json");
    expect(revision).toBe(2);

    const undone = undo(second.store, second.event_log);
    expect(undone).not.toBeNull();
    expect(await queryEvents("/analysis.gta.json")).toHaveLength(2);
  });

  it("queues failed audit writes and retries them on the next dispatch", async () => {
    let failCount = 1;
    const events: string[] = [];
    const revisions = new Map<string, number>();

    setEventPersistenceAdapter({
      persistEventSync(event, analysisId) {
        if (failCount > 0) {
          failCount -= 1;
          throw new Error("temporary failure");
        }
        events.push(`${analysisId}:${event.id}`);
      },
      queryEventsSync() {
        return [];
      },
      getCanonicalRevisionSync(analysisId) {
        return revisions.get(analysisId) ?? 0;
      },
      incrementRevisionSync(analysisId) {
        const next = (revisions.get(analysisId) ?? 0) + 1;
        revisions.set(analysisId, next);
        return next;
      },
      reset() {
        events.length = 0;
        revisions.clear();
        failCount = 1;
      },
    });

    const store = createSampleCanonicalStore();
    const first = dispatch(store, createEventLog("/analysis.gta.json"), {
      kind: "add_claim",
      payload: {
        statement: "Queued event",
        based_on: ["observation_1"],
        confidence: 0.3,
      },
    });

    expect(first.status).toBe("committed");
    if (first.status !== "committed") {
      throw new Error("Expected first command to commit.");
    }
    expect(first.event_log.pending_persisted_events).toHaveLength(1);
    expect(first.event_log.last_persist_error).toMatch(/temporary failure/);

    const second = dispatch(first.store, first.event_log, {
      kind: "add_claim",
      payload: {
        statement: "Retry trigger",
        based_on: ["observation_1"],
        confidence: 0.2,
      },
    });

    expect(second.status).toBe("committed");
    if (second.status !== "committed") {
      throw new Error("Expected retry command to commit.");
    }
    expect(second.event_log.pending_persisted_events).toHaveLength(0);
    expect(second.event_log.persisted_revision).toBe(2);
    expect(events).toHaveLength(2);
  });
});
