import { describe, expect, it } from "vitest";
import {
  ENTITY_ARRIVAL_SETTLE_MS,
  getEntityArrivalSettleStyle,
} from "../entity-arrival-motion";

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
});
