import type { MethodologyPhase } from "./methodology";

export type PromptPackId = string;
export type PromptPackVersion = string;
export type PromptPackMode = "analysis-runtime" | "synthesis" | "chat";
export type PromptTemplateVariant =
  | "initial"
  | "revision"
  | "initial-tools"
  | "revision-tools";

export interface PromptPackSourceRef {
  kind: "bundled" | "filesystem";
  path?: string;
}

export interface PromptPackToolPolicy {
  enabledAnalysisTools: string[];
  webSearch?: boolean;
  notes?: string;
}

export interface PromptPackPhaseConfig {
  phase: MethodologyPhase;
  objective: string;
  doneCondition: string;
  toolPolicy: PromptPackToolPolicy;
}

export interface PromptTemplateDefinition {
  phase: string;
  variant: PromptTemplateVariant;
  text: string;
}

export interface PromptTemplateFileDefinition {
  phase: string;
  variant: PromptTemplateVariant;
  path: string;
}

export interface PromptPackDefinition {
  analysisType: string;
  mode: PromptPackMode;
  id: PromptPackId;
  version: PromptPackVersion;
  source: PromptPackSourceRef;
  phases?: PromptPackPhaseConfig[];
  templates: PromptTemplateDefinition[];
}

export interface PromptPackFileManifest {
  analysisType: string;
  mode: PromptPackMode;
  id: PromptPackId;
  version: PromptPackVersion;
  source?: PromptPackSourceRef;
  phases?: PromptPackPhaseConfig[];
  templateFiles: PromptTemplateFileDefinition[];
}

export interface ResolvedPromptTemplate extends PromptTemplateDefinition {
  templateHash: string;
  templateIdentity: string;
}

export interface ResolvedPromptPack extends Omit<
  PromptPackDefinition,
  "templates"
> {
  packHash: string;
  templates: ResolvedPromptTemplate[];
}

/**
 * Default prompt pack identity constants.
 * Used by the bundled game-theory prompt pack and referenced by tests.
 */
export const DEFAULT_PROMPT_PACK_ID = "game-theory/default" as const;
export const DEFAULT_PROMPT_PACK_VERSION = "2026-03-25.1" as const;
export const DEFAULT_PROMPT_PACK_MODE: PromptPackMode = "analysis-runtime";
export const DEFAULT_ANALYSIS_TYPE = "game-theory" as const;
export const SYNTHESIS_PROMPT_PACK_MODE: PromptPackMode = "synthesis";
export const CHAT_PROMPT_PACK_MODE: PromptPackMode = "chat";
