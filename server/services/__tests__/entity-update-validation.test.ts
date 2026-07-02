import { describe, expect, it } from "vitest";
import type { AnalysisEntity, EntityType } from "../../../src/types/entity";
import { entityDataSchema } from "../../../src/types/entity";
import {
  DATA_SCHEMAS,
  validateEntityUpdates,
} from "../entity-update-validation";

function makeFactEntity(): Pick<AnalysisEntity, "type" | "data"> {
  return {
    type: "fact",
    data: {
      type: "fact",
      date: "2026-03-19",
      source: "test",
      content: "Existing fact content",
      category: "action",
    },
  };
}

function makeAnalysisReportEntity(): Pick<AnalysisEntity, "type" | "data"> {
  return {
    type: "analysis-report",
    data: {
      type: "analysis-report",
      executive_summary: "Summary",
      why: "Because",
      key_evidence: ["Evidence 1"],
      open_assumptions: [],
      entity_references: [],
      prediction_verdict: null,
      what_would_change: ["A change"],
      source_url: null,
      analysis_timestamp: "2026-07-02T00:00:00Z",
    },
  };
}

function makeMetaCheckEntity(): Pick<AnalysisEntity, "type" | "data"> {
  return {
    type: "meta-check",
    data: {
      type: "meta-check",
      questions: Array.from({ length: 10 }, (_, i) => ({
        question_number: i + 1,
        answer: `Answer ${i + 1}`,
        disruption_trigger_identified: false,
      })),
    },
  };
}

describe("validateEntityUpdates", () => {
  // ── Schema map completeness ──

  it("covers every entity type in the discriminated union", () => {
    const unionTypes = entityDataSchema.def.options.map(
      (option) =>
        (option as { def: { shape: { type: { def: { values: unknown[] } } } } })
          .def.shape.type.def.values[0],
    );
    const mapTypes = Object.keys(DATA_SCHEMAS).sort();
    expect(mapTypes).toEqual([...unionTypes].sort());
    expect(mapTypes).toHaveLength(28);
  });

  it("maps each entity type to the schema with the matching discriminator", () => {
    for (const [type, schema] of Object.entries(DATA_SCHEMAS)) {
      const probe = schema.safeParse({ type });
      // Either the schema accepts the bare discriminator (no other required
      // fields) or its errors are about OTHER fields, never about `type`.
      if (!probe.success) {
        const typeIssue = probe.error.issues.find(
          (issue) => issue.path.join(".") === "type",
        );
        expect(typeIssue, `schema for ${type} rejects its own type`).toBe(
          undefined,
        );
      }
    }
  });

  // ── Accept paths ──

  it("accepts a full valid data replacement for a fact", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      data: {
        type: "fact",
        date: "2026-04-01",
        source: "news",
        content: "Updated content",
        category: "economic",
      },
    });
    expect(result).toEqual({
      ok: true,
      updates: {
        data: {
          type: "fact",
          date: "2026-04-01",
          source: "news",
          content: "Updated content",
          category: "economic",
        },
      },
    });
  });

  it("accepts a partial data edit by merging over current data", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      data: { content: "Only the content changed" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updates.data).toMatchObject({
        type: "fact",
        content: "Only the content changed",
        category: "action",
        source: "test",
      });
    }
  });

  it("accepts valid analysis-report edits", () => {
    const result = validateEntityUpdates(makeAnalysisReportEntity(), {
      data: { executive_summary: "Rewritten summary" },
      rationale: "Human correction",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts valid meta-check edits", () => {
    const entity = makeMetaCheckEntity();
    const questions = (
      entity.data as { questions: Array<Record<string, unknown>> }
    ).questions.map((q, i) => (i === 0 ? { ...q, answer: "Revised" } : q));
    const result = validateEntityUpdates(entity, { data: { questions } });
    expect(result.ok).toBe(true);
  });

  it("accepts confidence and rationale updates alone", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      confidence: "low",
      rationale: "Downgraded after review",
    });
    expect(result).toEqual({
      ok: true,
      updates: { confidence: "low", rationale: "Downgraded after review" },
    });
  });

  // ── Reject paths ──

  it("rejects data violating the per-type schema with field-level errors", () => {
    const result = validateEntityUpdates(makeAnalysisReportEntity(), {
      data: { executive_summary: "", key_evidence: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["data.executive_summary"]).toBeTruthy();
      expect(result.fieldErrors["data.key_evidence"]).toBeTruthy();
    }
  });

  it("rejects a meta-check edit that breaks the 10-question invariant", () => {
    const result = validateEntityUpdates(makeMetaCheckEntity(), {
      data: { questions: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["data.questions"]).toBeTruthy();
    }
  });

  it("rejects an invalid enum value with the field path", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      data: { category: "not-a-category" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["data.category"]).toBeTruthy();
    }
  });

  it("rejects attempts to change the entity type", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      data: { type: "player", name: "Sneaky" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["data.type"]).toBe(
        "Entity type cannot be changed",
      );
    }
  });

  it("rejects server-owned fields (legacy shape) with per-field errors", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      phase: "meta-check",
      revision: 99,
      stale: false,
      provenance: { source: "user-edited" },
      data: { content: "still validated" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.phase).toBe("Field is not editable");
      expect(result.fieldErrors.revision).toBe("Field is not editable");
      expect(result.fieldErrors.stale).toBe("Field is not editable");
      expect(result.fieldErrors.provenance).toBe("Field is not editable");
    }
  });

  it("rejects invalid confidence and empty rationale", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      confidence: "certain",
      rationale: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.confidence).toBeTruthy();
      expect(result.fieldErrors.rationale).toBe("Rationale cannot be empty");
    }
  });

  it("rejects non-object data", () => {
    const result = validateEntityUpdates(makeFactEntity(), {
      data: "not an object",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.data).toBe(
        "Expected an object of entity fields",
      );
    }
  });

  it("rejects an empty updates object", () => {
    const result = validateEntityUpdates(makeFactEntity(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.updates).toBe("No editable fields provided");
    }
  });

  // ── Per-type accept smoke across the whole map ──

  it("accepts an identity edit (current data re-submitted) for every type with a valid fixture", () => {
    // For types where we have realistic fixtures, re-submitting current data
    // must always validate — the merge path must never corrupt valid data.
    const fixtures: Array<Pick<AnalysisEntity, "type" | "data">> = [
      makeFactEntity(),
      makeAnalysisReportEntity(),
      makeMetaCheckEntity(),
      {
        type: "player",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
      },
      {
        type: "objective",
        data: {
          type: "objective",
          description: "Protect industry",
          priority: "high",
          stability: "stable",
        },
      },
      {
        type: "central-thesis",
        data: {
          type: "central-thesis",
          thesis: "Escalation is bounded",
          falsification_conditions: "Open conflict",
          supporting_scenarios: ["scenario-1"],
        },
      },
    ];

    for (const fixture of fixtures) {
      const result = validateEntityUpdates(fixture, {
        data: { ...(fixture.data as Record<string, unknown>) },
      });
      expect(result.ok, `identity edit failed for ${fixture.type}`).toBe(true);
    }
  });

  it("every schema in the map rejects data typed for a different entity", () => {
    const fact = makeFactEntity();
    for (const type of Object.keys(DATA_SCHEMAS) as EntityType[]) {
      if (type === "fact") continue;
      const result = validateEntityUpdates(
        { type, data: { type } as never },
        { data: { ...(fact.data as Record<string, unknown>) } },
      );
      // fact data claims type "fact" but the entity is `type` — must reject
      expect(result.ok, `type confusion accepted for ${type}`).toBe(false);
    }
  });
});
