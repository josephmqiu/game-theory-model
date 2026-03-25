import type { Analysis, LayoutState } from "./entity";

export type WorkspaceAnalysisType = "game-theory";

export interface WorkspaceThreadSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Application-level run correlation ID (not a provider session ID). Safe for portable storage. */
  latestRunId?: string;
  latestMessageAt?: number;
  summary?: string;
}

export interface WorkspaceArtifactHeader {
  id: string;
  type: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceCheckpointHeader {
  id: string;
  title: string;
  createdAt: number;
}

export interface WorkspacePendingQuestion {
  id: string;
  prompt: string;
  createdAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  analysisType: WorkspaceAnalysisType;
  createdAt: number;
  updatedAt: number;
  analysis: Analysis;
  layout: LayoutState;
  threads: WorkspaceThreadSummary[];
  artifacts: WorkspaceArtifactHeader[];
  checkpointHeaders: WorkspaceCheckpointHeader[];
  pendingQuestions: WorkspacePendingQuestion[];
}

export interface WorkspaceEnvelopeV4 {
  type: "game-theory-workspace";
  version: 4;
  workspace: Workspace;
}
