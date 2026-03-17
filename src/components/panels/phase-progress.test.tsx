/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhaseProgressPanel } from "@/components/panels/phase-progress";
import { buildAllPhaseProgress } from "shared/game-theory/tools/phase-mapping";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import type { PhaseProgress } from "shared/game-theory/types/agent";

function emptyPhases(): PhaseProgress[] {
  return buildAllPhaseProgress(
    emptyCanonicalStore() as unknown as Record<string, Record<string, unknown>>,
  );
}

describe("PhaseProgressPanel", () => {
  it("renders exactly 10 phase rows", () => {
    render(<PhaseProgressPanel phases={emptyPhases()} />);
    // Each row contains the phase name — count by looking for text of each phase
    const phaseNames = [
      "Situational Grounding",
      "Player Identification",
      "Baseline Game Modelling",
      "Historical Game & Repeated Interaction",
      "Revalidation Loop",
      "Formal Representation",
      "Assumption & Sensitivity Extraction",
      "Outcome Elimination",
      "Scenario Generation",
      "Meta-Check",
    ];
    for (const name of phaseNames) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it("renders empty indicators for all phases when canonical is empty", () => {
    const { container } = render(<PhaseProgressPanel phases={emptyPhases()} />);
    // Filled indicators have bg-primary; empty ones have bg-transparent.
    // None should have bg-primary for an empty store.
    const filledDots = container.querySelectorAll(".bg-primary");
    expect(filledDots).toHaveLength(0);
  });

  it("renders a filled indicator for phase 2 when a player exists", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": { id: "player-1", name: "Alice" },
        "player-2": { id: "player-2", name: "Bob" },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );

    const { container } = render(<PhaseProgressPanel phases={phases} />);
    const filledDots = container.querySelectorAll(".bg-primary");
    expect(filledDots.length).toBeGreaterThanOrEqual(1);
  });

  it("renders entity summary for a populated phase", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": { id: "player-1", name: "Alice" },
        "player-2": { id: "player-2", name: "Bob" },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );

    render(<PhaseProgressPanel phases={phases} />);
    // Entity summary shows "2 players"
    expect(screen.getByText("2 players")).toBeDefined();
  });

  it("renders coverage warnings as yellow text", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": { id: "player-1", name: "Solo" },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );

    const { container } = render(<PhaseProgressPanel phases={phases} />);
    // At least one warning paragraph should exist
    const warnings = container.querySelectorAll(
      ".text-yellow-600, .dark\\:text-yellow-400",
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("accepts an optional className", () => {
    const { container } = render(
      <PhaseProgressPanel phases={emptyPhases()} className="my-custom-class" />,
    );
    expect(
      container.firstElementChild?.classList.contains("my-custom-class"),
    ).toBe(true);
  });
});
