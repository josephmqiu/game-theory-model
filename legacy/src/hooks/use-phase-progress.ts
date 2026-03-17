/**
 * usePhaseProgress — derives PhaseProgress for all 10 analysis phases
 * from the canonical store's entity collections.
 *
 * Reuses buildAllPhaseProgress from the browser-safe phase-mapping module,
 * which intentionally has no Node.js dependencies.
 */

import { useMemo } from "react";
import { useAnalysisStore } from "@/stores/analysis-store";
import { buildAllPhaseProgress } from "shared/game-theory/tools/phase-mapping";
import type { PhaseProgress } from "shared/game-theory/types/agent";

export function usePhaseProgress(): PhaseProgress[] {
  const canonical = useAnalysisStore((s) => s.canonical);
  return useMemo(
    () =>
      buildAllPhaseProgress(
        canonical as unknown as Record<string, Record<string, unknown>>,
      ),
    [canonical],
  );
}
