import { describe, expect, it } from "vitest";
import type { AnalysisEntity } from "@/types/entity";
import type { FrameNode, TextNode } from "@/types/pen";
import { entityToRenderNode } from "@/services/entity/entity-to-pennode";

function makeEntity(
  overrides: Partial<AnalysisEntity> &
    Pick<AnalysisEntity, "id" | "type" | "phase" | "data">,
): AnalysisEntity {
  return {
    position: { x: 0, y: 0 },
    confidence: "medium",
    source: "ai",
    rationale: "",
    revision: 1,
    stale: false,
    ...overrides,
  };
}

describe("entityToRenderNode", () => {
  it("maps a fact entity to correct size (140x60) and role", () => {
    const entity = makeEntity({
      id: "f1",
      type: "fact",
      phase: "situational-grounding",
      position: { x: 100, y: 200 },
      data: {
        type: "fact",
        date: "2026-01-15",
        source: "Reuters",
        content: "Trade tariffs increased",
        category: "economic",
      },
    });

    const rn = entityToRenderNode(entity);

    expect(rn.absW).toBe(140);
    expect(rn.absH).toBe(60);
    expect(rn.absX).toBe(100);
    expect(rn.absY).toBe(200);
    expect(rn.node.role).toBe("entity-fact");
  });

  it("maps a player entity to correct size (160x80) and role", () => {
    const entity = makeEntity({
      id: "p1",
      type: "player",
      phase: "player-identification",
      position: { x: 500, y: 0 },
      data: {
        type: "player",
        name: "United States",
        playerType: "primary",
        knowledge: [],
      },
    });

    const rn = entityToRenderNode(entity);

    expect(rn.absW).toBe(160);
    expect(rn.absH).toBe(80);
    expect(rn.node.role).toBe("entity-player");
  });

  it("maps a game entity to correct size (160x80) and role", () => {
    const entity = makeEntity({
      id: "g1",
      type: "game",
      phase: "baseline-model",
      position: { x: 900, y: 0 },
      data: {
        type: "game",
        name: "Tariff Escalation",
        gameType: "chicken",
        timing: "sequential",
        description: "",
      },
    });

    const rn = entityToRenderNode(entity);

    expect(rn.absW).toBe(160);
    expect(rn.absH).toBe(80);
    expect(rn.node.role).toBe("entity-game");
  });

  it("maps objective and strategy entities to 120x50", () => {
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

    expect(entityToRenderNode(obj).absW).toBe(120);
    expect(entityToRenderNode(obj).absH).toBe(50);
    expect(entityToRenderNode(strat).absW).toBe(120);
    expect(entityToRenderNode(strat).absH).toBe(50);
  });

  it("includes entity name as first text child node", () => {
    const entity = makeEntity({
      id: "p1",
      type: "player",
      phase: "player-identification",
      position: { x: 0, y: 0 },
      data: {
        type: "player",
        name: "China",
        playerType: "primary",
        knowledge: [],
      },
    });

    const rn = entityToRenderNode(entity);
    const frame = rn.node as FrameNode;
    expect(frame.children).toBeDefined();
    expect(frame.children!.length).toBe(2);

    const nameChild = frame.children![0] as TextNode;
    expect(nameChild.type).toBe("text");
    expect(nameChild.content).toBe("China");
    expect(nameChild.fontSize).toBe(14);
    expect(nameChild.fontWeight).toBe(600);
    expect(nameChild.fontFamily).toBe("Geist");
  });

  it("includes entity meta line as second text child node", () => {
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

    const rn = entityToRenderNode(entity);
    const frame = rn.node as FrameNode;
    const metaChild = frame.children![1] as TextNode;
    expect(metaChild.type).toBe("text");
    expect(metaChild.content).toBe("fact / economic");
    expect(metaChild.fontSize).toBe(12);
    expect(metaChild.fontWeight).toBe(400);
  });

  it("uses entity position for RenderNode coordinates", () => {
    const entity = makeEntity({
      id: "g1",
      type: "game",
      phase: "baseline-model",
      position: { x: 300, y: 450 },
      data: {
        type: "game",
        name: "Arms Race",
        gameType: "prisoners-dilemma",
        timing: "repeated",
        description: "",
      },
    });

    const rn = entityToRenderNode(entity);
    expect(rn.absX).toBe(300);
    expect(rn.absY).toBe(450);
    expect(rn.node.x).toBe(300);
    expect(rn.node.y).toBe(450);
  });

  it("truncates long entity names", () => {
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

    const rn = entityToRenderNode(entity);
    const frame = rn.node as FrameNode;
    const nameChild = frame.children![0] as TextNode;
    expect((nameChild.content as string).length).toBeLessThanOrEqual(30);
    expect(nameChild.content).toContain("...");
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

    const rn = entityToRenderNode(entity);
    const frame = rn.node as FrameNode;
    const nameChild = frame.children![0] as TextNode;
    expect(nameChild.content).toBe("payoff");
  });
});
