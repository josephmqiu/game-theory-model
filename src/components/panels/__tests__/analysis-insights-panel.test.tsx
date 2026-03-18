// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useAnalysisStore } from "@/stores/analysis-store";
import AnalysisPanel from "@/components/panels/analysis-panel";

function setPayoffs(payoffs: Array<[number, number]>) {
  act(() => {
    const state = useAnalysisStore.getState();
    const [player1, player2] = state.analysis.players;

    payoffs.forEach(([player1Payoff, player2Payoff], index) => {
      const player1Strategy = player1.strategies[Math.floor(index / 2)];
      const player2Strategy = player2.strategies[index % 2];

      state.setPayoff(
        player1Strategy.id,
        player2Strategy.id,
        player1.id,
        player1Payoff,
      );
      state.setPayoff(
        player1Strategy.id,
        player2Strategy.id,
        player2.id,
        player2Payoff,
      );
    });
  });
}

function setMatchingPenniesPayoffs() {
  setPayoffs([
    [1, 0],
    [0, 1],
    [0, 1],
    [1, 0],
  ]);
}

describe("Phase 5 analysis insights panel coverage", () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a blocked strategic insights state before the matrix is complete", () => {
    const { container } = render(<AnalysisPanel />);

    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Analysis readiness",
    );
    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Complete every payoff cell before strategic insights can compute best responses, dominance, and pure Nash equilibria.",
    );
    expect(screen.getByTestId("analysis-review").textContent).toContain(
      "4 payoff cells still incomplete",
    );
    expect(
      screen.getByText("Strategy 1 vs Strategy 1").parentElement?.className,
    ).not.toContain("bg-amber-500/10");
    expect(container.innerHTML).toContain(
      "Strategic highlights appear after the analysis is valid and every payoff cell is complete.",
    );
  });

  it("unlocks strategic insights once all payoff cells are complete", () => {
    render(<AnalysisPanel />);
    setPayoffs([
      [4, 4],
      [1, 5],
      [5, 1],
      [2, 2],
    ]);

    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Pure Nash equilibria",
    );
    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Best responses",
    );
    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Dominance",
    );
    expect(
      screen.getByText("Strategy 2 vs Strategy 2").parentElement?.className,
    ).toContain("bg-amber-500/10");
  });

  it("highlights the equilibrium cell on the existing payoff matrix", () => {
    render(<AnalysisPanel />);
    setPayoffs([
      [4, 4],
      [1, 5],
      [5, 1],
      [2, 2],
    ]);

    const equilibriumCell = screen
      .getByText("Strategy 2 vs Strategy 2")
      .parentElement;

    expect(equilibriumCell?.className).toContain("bg-amber-500/10");
    expect(equilibriumCell?.className).toContain("border-amber-500/60");
  });

  it("shows an explicit empty state when no pure Nash equilibrium exists", () => {
    render(<AnalysisPanel />);
    setMatchingPenniesPayoffs();

    expect(
      screen.getByText(
        "No pure Nash equilibrium is present in the current matrix.",
      ),
    ).not.toBeNull();
    expect(screen.getByTestId("strategic-insights").textContent).toContain(
      "Best responses",
    );
    expect(
      screen.getByText("Strategy 1 vs Strategy 1").parentElement?.className,
    ).not.toContain("bg-amber-500/10");
  });
});
