import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const analysisCanvasPath = join(
  process.cwd(),
  "src/components/editor/analysis-canvas.tsx",
);

describe("analysis canvas Phase 6 behavior", () => {
  it("supports drag-to-pin entity repositioning in source", () => {
    const source = readFileSync(analysisCanvasPath, "utf8");

    expect(source).toContain("pinEntityPosition");
    expect(source).toContain("dragRef");
    expect(source).toContain("getHitEntity");
  });

  it("does not compute auto-layout inside the render effect", () => {
    const source = readFileSync(analysisCanvasPath, "utf8");

    expect(source).not.toContain("layoutEntities(");
    expect(source).not.toContain("missingLayoutEntities");
  });
});
