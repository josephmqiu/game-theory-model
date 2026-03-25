import { describe, expect, it } from "vitest";
import {
  isEntityCardRole,
  shouldDrawFrameLabel,
} from "@/canvas/skia/frame-label-utils";

describe("frame label utils", () => {
  it("recognizes entity card roles", () => {
    expect(isEntityCardRole("entity-fact")).toBe(true);
    expect(isEntityCardRole("entity-player")).toBe(true);
    expect(isEntityCardRole("frame")).toBe(false);
    expect(isEntityCardRole(undefined)).toBe(false);
  });

  it("does not draw frame labels for entity cards", () => {
    expect(
      shouldDrawFrameLabel(
        { type: "frame", name: "A fact", role: "entity-fact" },
        undefined,
        false,
        false,
      ),
    ).toBe(false);
  });

  it("still draws labels for non-entity root frames and instances", () => {
    expect(
      shouldDrawFrameLabel(
        { type: "frame", name: "Workspace" },
        undefined,
        false,
        false,
      ),
    ).toBe(true);

    expect(
      shouldDrawFrameLabel(
        { type: "frame", name: "Component Instance" },
        { x: 0, y: 0, w: 100, h: 100, rx: 0 },
        false,
        true,
      ),
    ).toBe(true);
  });
});
