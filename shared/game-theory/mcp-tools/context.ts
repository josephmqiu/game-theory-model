import type { z } from "zod";

import type { CanonicalStore, EntityType } from "../types/canonical";
import type {
  PipelineHost,
  PipelineRuntimeSnapshot,
  PipelineSnapshot,
} from "../pipeline/host";
import type { PipelineOrchestrator } from "../types/analysis-pipeline";
import type { AnalysisFile } from "../types/file";
import type { McpUiPhaseStatus } from "../types/mcp";

export interface McpServerLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTool<T extends z.ZodTypeAny>(definition: {
    name: string;
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>) => unknown;
  }): void;
}

export interface RuntimeToolContext {
  host: PipelineHost;
  server: McpServerLike;
  orchestrator: PipelineOrchestrator;

  getModel(): AnalysisFile | null;
  getCanonicalStore(): CanonicalStore;
  getAllPhaseStatuses(): ReadonlyArray<{
    phase: number;
    status: McpUiPhaseStatus;
  }>;
  getEntities<T>(type: EntityType): ReadonlyArray<T>;
  getPersistedRevision(): number;
  getPipelineState(): PipelineSnapshot;
  getPipelineRuntimeState(): PipelineRuntimeSnapshot;
}
