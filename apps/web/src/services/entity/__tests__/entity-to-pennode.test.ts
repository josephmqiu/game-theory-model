import { describe, expect, it } from "vitest";
import type { AnalysisEntity, LayoutState } from "@/types/entity";
import type { FrameNode, TextNode } from "@/types/pen";
import { entityToRenderNode } from "@/services/entity/entity-to-pennode";
import {
  getEntityCardMetrics,
  truncateEntityCardText,
} from "@/services/entity/entity-card-metrics";

function makeEntity(
  overrides: Partial<AnalysisEntity> &
    Pick<AnalysisEntity, "id" | "type" | "phase" | "data">,
): AnalysisEntity {
  return {
    confidence: "medium",
    source: "ai",
    rationale: "",
    revision: 1,
    stale: false,
    ...overrides,
  };
}

function makeLayoutEntry(
  overrides: Partial<LayoutState[string]> = {},
): LayoutState[string] {
  return {
    x: 0,
    y: 0,
    pinned: false,
    ...overrides,
  };
}

describe("entityToRenderNode", () => {
  it("maps a fact entity to correct size (240x85) and role", () => {
    const entity = makeEntity({
      id: "f1",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-01-15",
        source: "Reuters",
        content: "Trade tariffs increased",
        category: "economic",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry({ x: 100, y: 200 }));
    const metrics = getEntityCardMetrics("fact");

    expect(rn.absW).toBe(metrics.width);
    expect(rn.absH).toBe(metrics.height);
    expect(rn.absX).toBe(100);
    expect(rn.absY).toBe(200);
    expect(rn.node.role).toBe("entity-fact");
  });

  it("maps a player entity to correct size (260x100) and role", () => {
    const entity = makeEntity({
      id: "p1",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "United States",
        playerType: "primary",
        knowledge: [],
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry({ x: 500, y: 0 }));
    const metrics = getEntityCardMetrics("player");

    expect(rn.absW).toBe(metrics.width);
    expect(rn.absH).toBe(metrics.height);
    expect(rn.node.role).toBe("entity-player");
  });

  it("maps a game entity to correct size (260x100) and role", () => {
    const entity = makeEntity({
      id: "g1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Tariff Escalation",
        gameType: "chicken",
        timing: "sequential",
        description: "",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry({ x: 900, y: 0 }));
    const metrics = getEntityCardMetrics("game");

    expect(rn.absW).toBe(metrics.width);
    expect(rn.absH).toBe(metrics.height);
    expect(rn.node.role).toBe("entity-game");
  });

  it("maps objective and strategy entities to 220x75", () => {
    const obj = makeEntity({
      id: "o1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Maximize trade surplus",
        priority: "high",
        stability: "stable",
      },
    });
    const strat = makeEntity({
      id: "s1",
      type: "strategy",
      phase: "baseline-model",
      data: {
        type: "strategy",
        name: "Retaliate",
        feasibility: "actual",
        description: "",
      },
    });

    expect(entityToRenderNode(obj, makeLayoutEntry()).absW).toBe(
      getEntityCardMetrics("objective").width,
    );
    expect(entityToRenderNode(obj, makeLayoutEntry()).absH).toBe(
      getEntityCardMetrics("objective").height,
    );
    expect(entityToRenderNode(strat, makeLayoutEntry()).absW).toBe(
      getEntityCardMetrics("strategy").width,
    );
    expect(entityToRenderNode(strat, makeLayoutEntry()).absH).toBe(
      getEntityCardMetrics("strategy").height,
    );
  });

  it("includes type badge as first child, name as second, meta as third", () => {
    const entity = makeEntity({
      id: "p1",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "China",
        playerType: "primary",
        knowledge: [],
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    expect(frame.children).toBeDefined();
    expect(frame.children!.length).toBe(3);

    // Badge (child 0)
    const badgeChild = frame.children![0] as TextNode;
    expect(badgeChild.type).toBe("text");
    expect(badgeChild.content).toBe("PLAYER");
    expect(badgeChild.fontSize).toBe(11);
    expect(badgeChild.fontWeight).toBe(500);

    // Name (child 1)
    const nameChild = frame.children![1] as TextNode;
    expect(nameChild.type).toBe("text");
    expect(nameChild.content).toBe("China");
    expect(nameChild.fontSize).toBe(15);
    expect(nameChild.fontWeight).toBe(600);
    expect(nameChild.fontFamily).toBe("Geist");

    // Meta (child 2)
    const metaChild = frame.children![2] as TextNode;
    expect(metaChild.type).toBe("text");
    expect(metaChild.content).toBe("player / primary");
    expect(metaChild.fontSize).toBe(12);
    expect(metaChild.fontWeight).toBe(400);
  });

  it("uses layout state for RenderNode coordinates", () => {
    const entity = makeEntity({
      id: "g1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Arms Race",
        gameType: "prisoners-dilemma",
        timing: "repeated",
        description: "",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry({ x: 300, y: 450 }));
    expect(rn.absX).toBe(300);
    expect(rn.absY).toBe(450);
    expect(rn.node.x).toBe(300);
    expect(rn.node.y).toBe(450);
  });

  it("keeps the full entity name on the frame while truncating the canvas title", () => {
    const entity = makeEntity({
      id: "f1",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2026-01-15",
        source: "Reuters",
        content:
          "This is a very long fact content that exceeds thirty characters by a lot",
        category: "economic",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    const nameChild = frame.children![1] as TextNode;
    expect(frame.name).toBe(
      "This is a very long fact content that exceeds thirty characters by a lot",
    );
    expect(nameChild.content).toBe(
      truncateEntityCardText(
        "This is a very long fact content that exceeds thirty characters by a lot",
        getEntityCardMetrics("fact").titleMaxChars,
      ),
    );
    expect(nameChild.content).toContain("…");
  });

  it("truncates long objective titles for concise cards", () => {
    const entity = makeEntity({
      id: "o1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description:
          "Exploit opponent behavioral patterns to achieve expected payoff above equilibrium over repeated rounds",
        priority: "high",
        stability: "shifting",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    const nameChild = frame.children![1] as TextNode;
    expect(nameChild.content).toBe(
      truncateEntityCardText(
        "Exploit opponent behavioral patterns to achieve expected payoff above equilibrium over repeated rounds",
        getEntityCardMetrics("objective").titleMaxChars,
      ),
    );
    expect(nameChild.content).toContain("…");
  });

  it("truncates long meta lines to keep them inside the card budget", () => {
    const entity = makeEntity({
      id: "c1",
      type: "cross-game-constraint-table",
      phase: "formal-modeling",
      data: {
        type: "cross-game-constraint-table",
        strategies: ["Tariff", "Embargo"],
        games: ["Trade", "Security", "Diplomacy", "Technology"],
        cells: [],
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    const metaChild = frame.children![2] as TextNode;
    expect(metaChild.content).toBe(
      truncateEntityCardText(
        "constraints / 4 games",
        getEntityCardMetrics("cross-game-constraint-table").metaMaxChars,
      ),
    );
  });

  it("uses type as fallback display name when no name/content field", () => {
    const entity = makeEntity({
      id: "pay1",
      type: "payoff",
      phase: "baseline-model",
      data: {
        type: "payoff",
        rank: 1,
        value: 10,
        rationale: "",
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    const nameChild = frame.children![1] as TextNode;
    expect(nameChild.content).toBe("payoff");
  });

  it("formats type badge as uppercase with spaces", () => {
    const entity = makeEntity({
      id: "cg1",
      type: "cross-game-effect",
      phase: "formal-modeling",
      data: {
        type: "cross-game-effect",
        sourceGame: "Trade",
        targetGame: "Security",
        trigger: "tariff escalation",
        effectType: "payoff-shift",
        magnitude: "high",
        direction: "negative",
        cascade: true,
      },
    });

    const rn = entityToRenderNode(entity, makeLayoutEntry());
    const frame = rn.node as FrameNode;
    const badgeChild = frame.children![0] as TextNode;
    expect(badgeChild.content).toBe("CROSS GAME EFFECT");
  });
});
