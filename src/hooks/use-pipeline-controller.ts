/**
 * Pipeline controller hook — thin composition of the domain orchestrator
 * with the Zustand-backed PipelineHost.
 *
 * This is NOT a second orchestration layer. It's the renderer's entry point
 * to the existing createPipelineOrchestrator().
 */

import { useMemo } from "react";
import { createPipelineOrchestrator } from "shared/game-theory/pipeline/orchestrator";
import type { PipelineOrchestrator } from "shared/game-theory/types/analysis-pipeline";
import { createPipelineHostFromStores } from "@/services/pipeline-host";

export function usePipelineController(): PipelineOrchestrator {
  return useMemo(() => {
    const host = createPipelineHostFromStores();
    return createPipelineOrchestrator(host);
  }, []);
}
