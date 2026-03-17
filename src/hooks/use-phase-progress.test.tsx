/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { buildAllPhaseProgress } from "shared/game-theory/tools/phase-mapping";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import type { CanonicalStore } from "shared/game-theory/types/canonical";

// ── Mocked analysis store ─────────────────────────────────────────────────
// useAnalysisStore calls Zustand's useStore which imports useCallback from a
// separate React instance, causing an "Invalid hook call" in jsdom. We mock
// the module so the hook tests don't go through Zustand at all.

// vi.hoisted runs before imports so we cannot call emptyCanonicalStore() here.
const mockCanonical = vi.hoisted(() => ({
  current: null as CanonicalStore | null,
}));

vi.mock("@/stores/analysis-store", () => ({
  useAnalysisStore: (
    selector: (state: { canonical: CanonicalStore }) => unknown,
  ) => selector({ canonical: mockCanonical.current! }),
}));

// ── Pure function tests (no React needed) ──────────────────────────────────

describe("buildAllPhaseProgress (pure function)", () => {
  it("returns exactly 10 phases", () => {
    const canonical = emptyCanonicalStore();
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    expect(phases).toHaveLength(10);
  });

  it("all phases have has_entities: false on an empty canonical store", () => {
    const canonical = emptyCanonicalStore();
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    for (const phase of phases) {
      expect(phase.has_entities).toBe(false);
    }
  });

  it("phase 2 has_entities becomes true when a player is added", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": {
          id: "player-1",
          name: "Alice",
          kind: "individual",
          role: "primary",
        },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    const phase2 = phases.find((p) => p.phase === 2);
    expect(phase2?.has_entities).toBe(true);
  });

  it("phase 2 issues a coverage warning when 1 player exists with no sources", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": { id: "player-1", name: "Alice" },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    const phase2 = phases.find((p) => p.phase === 2);
    expect(phase2?.coverage_warnings.length).toBeGreaterThan(0);
  });

  it("phase 1 has_entities becomes true when a source is added", () => {
    const canonical = {
      ...emptyCanonicalStore(),
      sources: {
        "src-1": { id: "src-1", title: "Reuters" },
      },
    };
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    const phase1 = phases.find((p) => p.phase === 1);
    expect(phase1?.has_entities).toBe(true);
  });

  it("phase 10 always has has_entities: false (no entity keys)", () => {
    const canonical = emptyCanonicalStore();
    const phases = buildAllPhaseProgress(
      canonical as unknown as Record<string, Record<string, unknown>>,
    );
    const phase10 = phases.find((p) => p.phase === 10);
    expect(phase10?.has_entities).toBe(false);
    expect(phase10?.entity_counts).toEqual({});
  });
});

// ── Hook tests ──────────────────────────────────────────────────────────────
// Uses createRoot + async act (same pattern as smoke-hook.test.tsx).
// The analysis store is mocked above so we avoid Zustand's React copy.

describe("usePhaseProgress hook (with mocked store)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockCanonical.current = emptyCanonicalStore();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  function getPhasesFromDOM() {
    const el = container.querySelector("[data-testid='phases']");
    if (!el) return [];
    return JSON.parse(el.getAttribute("data-phases") ?? "[]") as ReturnType<
      typeof buildAllPhaseProgress
    >;
  }

  it("returns 10 phases", async () => {
    const { usePhaseProgress } = await import("@/hooks/use-phase-progress");

    function Harness() {
      const phases = usePhaseProgress();
      return (
        <div
          data-testid="phases"
          data-count={phases.length}
          data-phases={JSON.stringify(phases)}
        />
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(getPhasesFromDOM()).toHaveLength(10);
  });

  it("returns all phases with has_entities: false for an empty store", async () => {
    const { usePhaseProgress } = await import("@/hooks/use-phase-progress");

    function Harness() {
      const phases = usePhaseProgress();
      return <div data-testid="phases" data-phases={JSON.stringify(phases)} />;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    for (const phase of getPhasesFromDOM()) {
      expect(phase.has_entities).toBe(false);
    }
  });

  it("phase 2 has_entities is true when the store has players", async () => {
    mockCanonical.current = {
      ...emptyCanonicalStore(),
      players: {
        "player-1": { id: "player-1", name: "Alice" } as never,
        "player-2": { id: "player-2", name: "Bob" } as never,
      },
    };

    const { usePhaseProgress } = await import("@/hooks/use-phase-progress");

    function Harness() {
      const phases = usePhaseProgress();
      return <div data-testid="phases" data-phases={JSON.stringify(phases)} />;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const phase2 = getPhasesFromDOM().find((p) => p.phase === 2);
    expect(phase2?.has_entities).toBe(true);
  });

  it("phase names are present and non-empty for all 10 phases", async () => {
    const { usePhaseProgress } = await import("@/hooks/use-phase-progress");

    function Harness() {
      const phases = usePhaseProgress();
      return <div data-testid="phases" data-phases={JSON.stringify(phases)} />;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const phases = getPhasesFromDOM();
    expect(phases).toHaveLength(10);
    for (const phase of phases) {
      expect(typeof phase.name).toBe("string");
      expect(phase.name.length).toBeGreaterThan(0);
    }
  });
});
