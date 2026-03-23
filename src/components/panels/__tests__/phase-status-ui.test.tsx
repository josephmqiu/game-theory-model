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
    expect(source).toContain("analysis.progress.phaseFailed");
  });

  it("renders later runnable phases as live entries in the sidebar source", () => {
    const source = readFileSync(phaseSidebarPath, "utf8");

    expect(source).toContain("V3_PHASES.map");
    expect(source).toContain("PHASE_I18N_KEYS[phase]");
    expect(source).toContain("getRunnablePhaseNumber(phase)");
    expect(source).not.toContain("Coming soon");
  });

  it("keeps the failure tooltip wiring in the sidebar source", () => {
    const source = readFileSync(phaseSidebarPath, "utf8");

    expect(source).toContain("getRunFailureLabel");
    expect(source).toContain('TooltipContent side="right"');
  });
});
