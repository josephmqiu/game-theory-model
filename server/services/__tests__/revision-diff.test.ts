import { beforeEach, describe, expect, it } from "vitest";
import { _resetForTest, newAnalysis } from "../entity-graph-service";
import {
  beginPhaseTransaction,
  commitPhaseTransaction,
  rollbackPhaseTransaction,
  getActivePhaseTransaction,
} from "../revision-diff";

beforeEach(() => {
  // Ensure no leftover transaction from a previous test
  rollbackPhaseTransaction();
  _resetForTest();
  newAnalysis("test topic");
});

describe("phase transactions", () => {
  it("beginPhaseTransaction creates an active transaction", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    const active = getActivePhaseTransaction();
    expect(active).not.toBeNull();
    expect(active?.phase).toBe("situational-grounding");
    expect(active?.runId).toBe("run-1");
  });

  it("commitPhaseTransaction finalizes the active transaction", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    const result = commitPhaseTransaction();
    expect(result).toBeDefined();
    expect(result.currentPhaseEntityIds).toBeDefined();
    expect(getActivePhaseTransaction()).toBeNull();
  });

  it("rollbackPhaseTransaction discards the active transaction", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    rollbackPhaseTransaction();
    expect(getActivePhaseTransaction()).toBeNull();
  });

  it("commitPhaseTransaction throws when no transaction is active", () => {
    expect(() => commitPhaseTransaction()).toThrow();
  });

  it("beginPhaseTransaction throws on double-begin", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    expect(() =>
      beginPhaseTransaction("player-identification", "run-1"),
    ).toThrow("already active");
  });

  it("commitPhaseTransaction populates summary from counters", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    const result = commitPhaseTransaction(undefined, {
      entitiesCreated: 5,
      entitiesUpdated: 2,
      relationshipsCreated: 3,
    });

    expect(result.entitiesCreated).toBe(5);
    expect(result.entitiesUpdated).toBe(2);
    expect(result.relationshipsCreated).toBe(3);
  });

  it("commitPhaseTransaction defaults to zero without counters", () => {
    beginPhaseTransaction("situational-grounding", "run-1");

    const result = commitPhaseTransaction();

    expect(result.entitiesCreated).toBe(0);
    expect(result.entitiesUpdated).toBe(0);
    expect(result.relationshipsCreated).toBe(0);
  });
});
