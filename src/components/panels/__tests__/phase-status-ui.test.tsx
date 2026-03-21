import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const phaseSidebarPath = join(
  process.cwd(),
  "src/components/panels/phase-sidebar.tsx",
);
const phaseProgressPath = join(
  process.cwd(),
  "src/components/panels/phase-progress.tsx",
);

describe("phase status UI", () => {
  it("keeps runnable phase numbering and failure rendering in the progress bar source", () => {
    const source = readFileSync(phaseProgressPath, "utf8");

    expect(source).toContain("V3_PHASES");
    expect(source).toContain("getRunnablePhaseNumber");
    expect(source).toContain("Phase {getRunnablePhaseNumber(failedPhase.phase)} failed");
  });

  it("renders later runnable phases as live entries in the sidebar source", () => {
    const source = readFileSync(phaseSidebarPath, "utf8");

    expect(source).toContain("V3_PHASES.map");
    expect(source).toContain("PHASE_LABELS[phase]");
    expect(source).toContain("getRunnablePhaseNumber(phase)");
    expect(source).not.toContain("Coming soon");
  });

  it("keeps the failure tooltip wiring in the sidebar source", () => {
    const source = readFileSync(phaseSidebarPath, "utf8");

    expect(source).toContain("getPhaseFailureLabel");
    expect(source).toContain('TooltipContent side="right"');
    expect(source).toContain("Phase ${phaseNumber} failed");
  });
});
