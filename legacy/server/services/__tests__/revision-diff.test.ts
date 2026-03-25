import { beforeEach, describe, expect, it } from "vitest";
import type { AnalysisEntity } from "../../../shared/types/entity";
import {
  _resetForTest,
  createEntity,
  createRelationship,
  getAnalysis,
  newAnalysis,
  updateEntity,
} from "../entity-graph-service";
import { commitPhaseSnapshot } from "../revision-diff";

function makeFactOutput(overrides?: {
  id?: string | null;
  ref?: string;
  content?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "fact-ref",
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: overrides?.content ?? "A fact",
      category: "action" as const,
    },
    confidence: "high" as const,
    rationale: `rationale:${overrides?.content ?? "A fact"}`,
  };
}

function makePersistedFact(content: string): AnalysisEntity {
  return createEntity(
    {
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-03-19",
        source: "test",
        content,
        category: "action",
      },
      confidence: "high",
      rationale: `persisted:${content}`,
      revision: 1,
      stale: false,
    },
    {
      source: "phase-derived",
      runId: "seed-run",
      phase: "situational-grounding",
    },
  );
}

function makePersistedPlayer(name: string): AnalysisEntity {
  return createEntity(
    {
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name,
        playerType: "primary",
        knowledge: [],
      },
      confidence: "high",
      rationale: `persisted:${name}`,
      revision: 1,
      stale: false,
    },
    {
      source: "phase-derived",
      runId: "seed-run",
      phase: "player-identification",
    },
  );
}

beforeEach(() => {
  _resetForTest();
  newAnalysis("test topic");
});

describe("commitPhaseSnapshot", () => {
  it("creates new entities on initial run and resolves relationship refs to server ids", () => {
    const result = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-1",
      entities: [
        makeFactOutput({ ref: "fact-1", content: "Fact 1" }),
        makeFactOutput({ ref: "fact-2", content: "Fact 2" }),
      ],
      relationships: [
        {
          id: "rel-1",
          type: "precedes",
          fromEntityId: "fact-1",
          toEntityId: "fact-2",
        },
      ],
    });

    expect(result.status).toBe("applied");

    const analysis = getAnalysis();
    expect(analysis.entities).toHaveLength(2);
    expect(analysis.relationships).toHaveLength(1);
    expect(analysis.relationships[0].fromEntityId).toBe(analysis.entities[0].id);
    expect(analysis.relationships[0].toEntityId).toBe(analysis.entities[1].id);
    expect(analysis.relationships[0].provenance?.source).toBe("phase-derived");
    expect(analysis.relationships[0].provenance?.phase).toBe(
      "situational-grounding",
    );
  });

  it("updates by stable id, adds new entities, and deletes omitted AI-owned entities", () => {
    const kept = makePersistedFact("Keep me");
    const removed = makePersistedFact("Remove me");
    createRelationship(
      {
        type: "supports",
        fromEntityId: kept.id,
        toEntityId: removed.id,
      },
      {
        source: "phase-derived",
        runId: "seed-run",
        phase: "situational-grounding",
      },
    );

    const result = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-2",
      entities: [
        makeFactOutput({
          id: kept.id,
          ref: "kept-ref",
          content: "Keep me updated",
        }),
        makeFactOutput({
          id: null,
          ref: "new-ref",
          content: "Brand new fact",
        }),
      ],
      relationships: [
        {
          id: "rel-2",
          type: "precedes",
          fromEntityId: "kept-ref",
          toEntityId: "new-ref",
        },
      ],
    });

    expect(result).toMatchObject({
      status: "applied",
      summary: {
        entitiesCreated: 1,
        entitiesUpdated: 1,
        entitiesDeleted: 1,
      },
    });

    const analysis = getAnalysis();
    expect(analysis.entities).toHaveLength(2);
    const updated = analysis.entities.find((entity) => entity.id === kept.id);
    expect(updated?.data).toMatchObject({ content: "Keep me updated" });
    expect(updated?.revision).toBe(2);
    expect(analysis.entities.some((entity) => entity.id === removed.id)).toBe(
      false,
    );

    const newEntity = analysis.entities.find((entity) => entity.id !== kept.id);
    expect(newEntity).toBeDefined();
    expect(newEntity?.id).not.toBe(removed.id);
    expect(analysis.relationships).toHaveLength(1);
    expect(analysis.relationships[0]).toMatchObject({
      fromEntityId: kept.id,
      toEntityId: newEntity?.id,
    });
  });

  it("preserves omitted user-edited entities during AI revision", () => {
    const preserved = makePersistedFact("Human-kept fact");
    const aiOwned = makePersistedFact("AI fact");
    updateEntity(
      preserved.id,
      {
        rationale: "human rationale",
      },
      { source: "user-edited" },
    );

    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-3",
      entities: [
        makeFactOutput({
          id: aiOwned.id,
          ref: "ai-ref",
          content: "AI fact revised",
        }),
      ],
      relationships: [],
    });

    const analysis = getAnalysis();
    expect(analysis.entities.some((entity) => entity.id === preserved.id)).toBe(
      true,
    );
    expect(analysis.entities.find((entity) => entity.id === aiOwned.id)?.data).toMatchObject(
      {
        content: "AI fact revised",
      },
    );
  });

  it("preserves the user-edited version when AI returns conflicting data for that entity", () => {
    const preserved = makePersistedFact("Original");
    updateEntity(
      preserved.id,
      {
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "human",
          content: "Human override",
          category: "action",
        },
        rationale: "human rationale",
      },
      { source: "user-edited" },
    );

    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-4",
      entities: [
        makeFactOutput({
          id: preserved.id,
          ref: "preserved-ref",
          content: "AI tries to overwrite",
        }),
      ],
      relationships: [],
    });

    const current = getAnalysis().entities.find(
      (entity) => entity.id === preserved.id,
    );
    expect(current?.data).toMatchObject({ content: "Human override" });
    expect(current?.provenance?.source).toBe("user-edited");
  });

  it("rejects unknown non-null entity ids", () => {
    expect(() =>
      commitPhaseSnapshot({
        phase: "situational-grounding",
        runId: "run-5",
        entities: [
          makeFactOutput({
            id: "missing-id",
            ref: "fact-1",
            content: "Ghost",
          }),
        ],
        relationships: [],
      }),
    ).toThrow(/Unknown entity id/);
  });

  it("rejects entity ids from a different phase", () => {
    const player = makePersistedPlayer("Cross-phase player");

    expect(() =>
      commitPhaseSnapshot({
        phase: "situational-grounding",
        runId: "run-6",
        entities: [
          makeFactOutput({
            id: player.id,
            ref: "fact-1",
            content: "Wrong phase",
          }),
        ],
        relationships: [],
      }),
    ).toThrow(/belongs to phase "player-identification"|belongs to phase player-identification/);
  });

  it("accepts cross-phase relationship ids only when they point to real entities outside the current phase", () => {
    const player = makePersistedPlayer("Referenced player");

    const result = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-7",
      entities: [makeFactOutput({ ref: "fact-1", content: "Fact 1" })],
      relationships: [
        {
          id: "rel-1",
          type: "supports",
          fromEntityId: "fact-1",
          toEntityId: player.id,
        },
      ],
    });

    expect(result.status).toBe("applied");
    const createdFact = getAnalysis().entities.find(
      (entity) =>
        entity.phase === "situational-grounding" &&
        "content" in entity.data &&
        entity.data.content === "Fact 1",
    );
    const relationship = getAnalysis().relationships[0];
    expect(relationship).toMatchObject({
      fromEntityId: createdFact?.id,
      toEntityId: player.id,
    });
  });

  it("returns retry_required on first large reduction and commits on the second attempt", () => {
    const existing = [
      makePersistedFact("f1"),
      makePersistedFact("f2"),
      makePersistedFact("f3"),
      makePersistedFact("f4"),
      makePersistedFact("f5"),
    ];

    const firstAttempt = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-8",
      entities: [
        makeFactOutput({ id: existing[0].id, ref: "f1", content: "f1 revised" }),
        makeFactOutput({ id: existing[1].id, ref: "f2", content: "f2 revised" }),
      ],
      relationships: [],
    });

    expect(firstAttempt).toMatchObject({
      status: "retry_required",
      originalAiEntityCount: 5,
      returnedAiEntityCount: 2,
    });
    expect(getAnalysis().entities).toHaveLength(5);

    const secondAttempt = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "run-8",
      entities: [
        makeFactOutput({ id: existing[0].id, ref: "f1", content: "f1 revised" }),
        makeFactOutput({ id: existing[1].id, ref: "f2", content: "f2 revised" }),
      ],
      relationships: [],
      allowLargeReductionCommit: true,
    });

    expect(secondAttempt).toMatchObject({
      status: "applied",
      summary: {
        entitiesUpdated: 2,
        entitiesDeleted: 3,
      },
    });
    expect(getAnalysis().entities).toHaveLength(2);
    expect(getAnalysis().entities.map((entity) => entity.id)).toEqual([
      existing[0].id,
      existing[1].id,
    ]);
  });
});
