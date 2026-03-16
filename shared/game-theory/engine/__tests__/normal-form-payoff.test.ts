import { beforeEach, describe, expect, it } from "vitest";

import { createSampleCanonicalStore } from "../../test-support/sample-analysis";
import { dispatch, createEventLog } from "../dispatch";
import { resetPersistedEventStore } from "../event-persistence";

const samplePayoff = {
  representation: "cardinal_estimate" as const,
  value: 9,
  confidence: 0.9,
  rationale: "Updated payoff estimate.",
  source_claims: ["claim_1"],
};

describe("update_normal_form_payoff command", () => {
  beforeEach(() => {
    resetPersistedEventStore();
  });

  it("updates a payoff cell for a given player and cell index", () => {
    const store = createSampleCanonicalStore();
    const eventLog = createEventLog("/analysis.gta.json");

    const result = dispatch(store, eventLog, {
      kind: "update_normal_form_payoff",
      payload: {
        formalization_id: "formalization_1",
        cell_index: 0,
        player_id: "player_1",
        value: samplePayoff,
      },
    });

    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("Expected commit.");
    }

    const formalization = result.store.formalizations.formalization_1;
    if (formalization.kind !== "normal_form") {
      throw new Error("Expected normal_form formalization.");
    }

    expect(formalization.payoff_cells[0]?.payoffs.player_1).toMatchObject(
      samplePayoff,
    );
  });

  it("does not mutate the original store", () => {
    const store = createSampleCanonicalStore();
    const originalPayoff =
      store.formalizations.formalization_1.kind === "normal_form"
        ? store.formalizations.formalization_1.payoff_cells[0]?.payoffs.player_1
        : undefined;
    const eventLog = createEventLog("/analysis.gta.json");

    const result = dispatch(store, eventLog, {
      kind: "update_normal_form_payoff",
      payload: {
        formalization_id: "formalization_1",
        cell_index: 0,
        player_id: "player_1",
        value: samplePayoff,
      },
    });

    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("Expected commit.");
    }

    const updatedFormalization = result.store.formalizations.formalization_1;
    if (updatedFormalization.kind !== "normal_form") {
      throw new Error("Expected normal_form formalization.");
    }

    // Original store must be unchanged
    const originalFormalization = store.formalizations.formalization_1;
    if (originalFormalization.kind !== "normal_form") {
      throw new Error("Expected normal_form formalization.");
    }
    expect(originalFormalization.payoff_cells[0]?.payoffs.player_1).toEqual(
      originalPayoff,
    );
    expect(
      updatedFormalization.payoff_cells[0]?.payoffs.player_1,
    ).toMatchObject(samplePayoff);
  });

  it("rejects when formalization does not exist", () => {
    const store = createSampleCanonicalStore();
    const eventLog = createEventLog("/analysis.gta.json");

    const result = dispatch(store, eventLog, {
      kind: "update_normal_form_payoff",
      payload: {
        formalization_id: "formalization_missing",
        cell_index: 0,
        player_id: "player_1",
        value: samplePayoff,
      },
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("Expected rejection.");
    }
    expect(result.errors[0]).toMatch(/formalization_missing/);
  });

  it("rejects when formalization is not normal-form", () => {
    const store = createSampleCanonicalStore();
    // Add a non-normal-form formalization
    store.formalizations.formalization_extensive = {
      id: "formalization_extensive",
      game_id: "game_1",
      kind: "extensive_form",
      purpose: "explanatory",
      abstraction_level: "moderate",
      assumptions: [],
      root_node_id: "game_node_1",
      information_sets: [],
    };
    const eventLog = createEventLog("/analysis.gta.json");

    const result = dispatch(store, eventLog, {
      kind: "update_normal_form_payoff",
      payload: {
        formalization_id: "formalization_extensive",
        cell_index: 0,
        player_id: "player_1",
        value: samplePayoff,
      },
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("Expected rejection.");
    }
    expect(result.errors[0]).toMatch(/not normal-form/);
  });

  it("rejects when cell_index is out of bounds", () => {
    const store = createSampleCanonicalStore();
    const eventLog = createEventLog("/analysis.gta.json");

    const result = dispatch(store, eventLog, {
      kind: "update_normal_form_payoff",
      payload: {
        formalization_id: "formalization_1",
        cell_index: 99,
        player_id: "player_1",
        value: samplePayoff,
      },
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("Expected rejection.");
    }
    expect(result.errors[0]).toMatch(/out of bounds/);
  });
});
