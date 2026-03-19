// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PhaseProgress } from "@/components/panels/phase-progress";
import { useEntityGraphStore } from "@/stores/entity-graph-store";

const phaseSidebarPath = join(
  process.cwd(),
  "src/components/panels/phase-sidebar.tsx",
);

describe("phase status UI", () => {
  beforeEach(() => {
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
    useEntityGraphStore.getState().newAnalysis("Trade war");
    useEntityGraphStore
      .getState()
      .setPhaseStatus("situational-grounding", "complete");
    useEntityGraphStore
      .getState()
      .setPhaseStatus("player-identification", "failed");
  });

  it("renders a red failure state in the phase progress bar", () => {
    render(
      <PhaseProgress
        phaseFailures={{
          "player-identification": {
            failureKind: "timeout",
            runId: "run-timeout",
          },
        }}
      />,
    );

    expect(screen.getByText("Phase 2 failed")).toBeTruthy();
    expect(screen.getByText("timeout")).toBeTruthy();
  });

  it("keeps the failure tooltip wiring in the sidebar source", () => {
    const source = readFileSync(phaseSidebarPath, "utf8");

    expect(source).toContain("getPhaseFailureLabel");
    expect(source).toContain('TooltipContent side="right"');
    expect(source).toContain("Phase ${PHASE_NUMBERS[phase]} failed");
  });
});
