import { describe, expect, it, vi } from "vitest";
import type { AnalysisEntity } from "@/types/entity";
import {
  ENTITY_ARRIVAL_SETTLE_MS,
  getEntityArrivalSettleStyle,
} from "../entity-arrival-motion";
import { SkiaEngine } from "../skia-engine";

function entity(id: string): AnalysisEntity {
  return {
    id,
    type: "fact",
    phase: "situational-grounding",
    confidence: "medium",
    rationale: "test fixture",
    revision: 1,
    stale: false,
    provenance: {
      source: "user-edited",
      timestamp: 1_783_010_400_000,
    },
    data: {
      type: "fact",
      date: "2026-07-02",
      source: "test",
      content: id,
      category: "rule",
    },
  };
}

describe("getEntityArrivalSettleStyle", () => {
  it("starts slightly smaller and transparent", () => {
    expect(getEntityArrivalSettleStyle(1_000, 1_000, false)).toEqual({
      progress: 0,
      opacity: 0,
      scale: 0.96,
      active: true,
    });
  });

  it("settles to full scale and opacity after the duration", () => {
    expect(
      getEntityArrivalSettleStyle(
        1_000,
        1_000 + ENTITY_ARRIVAL_SETTLE_MS,
        false,
      ),
    ).toEqual({
      progress: 1,
      opacity: 1,
      scale: 1,
      active: false,
    });
  });

  it("skips motion when reduced motion is preferred", () => {
    expect(getEntityArrivalSettleStyle(1_000, 1_000, true)).toEqual({
      progress: 1,
      opacity: 1,
      scale: 1,
      active: false,
    });
  });

  it("keeps arrival stamps when a phase filter hides known entities", () => {
    const engine = new SkiaEngine({
      TypefaceFontProvider: {
        Make: () => ({ delete: vi.fn(), registerFont: vi.fn() }),
      },
    } as never);
    const e1 = entity("e1");
    const e2 = entity("e2");
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000);
    engine.setEntities([e1, e2], new Set(["e1", "e2"]));
    const timestamps = (engine as any).entityArrivalTimestamps as Map<
      string,
      number
    >;
    expect(timestamps.get("e1")).toBe(1_000);

    nowSpy.mockReturnValue(2_000);
    engine.setEntities([e2], new Set(["e1", "e2"]));
    expect(timestamps.get("e1")).toBe(1_000);

    nowSpy.mockReturnValue(3_000);
    engine.setEntities([e1, e2], new Set(["e1", "e2"]));
    expect(timestamps.get("e1")).toBe(1_000);

    engine.setEntities([e2], new Set(["e2"]));
    expect(timestamps.has("e1")).toBe(false);
    nowSpy.mockRestore();
  });
});
