import type { MethodologyPhase } from "./methodology";

export type PromptPackId = string;
export type PromptPackVersion = string;
export type PromptPackMode = "analysis-runtime";
export type PromptTemplateVariant = "initial" | "revision";

export interface PromptPackSourceRef {
  kind: "bundled" | "filesystem";
  path?: string;
}

export interface PromptTemplateDefinition {
  phase: MethodologyPhase;
  variant: PromptTemplateVariant;
  text: string;
}

export interface PromptPackDefinition {
  analysisType: string;
  mode: PromptPackMode;
  id: PromptPackId;
  version: PromptPackVersion;
  source: PromptPackSourceRef;
  templates: PromptTemplateDefinition[];
}

export interface ResolvedPromptTemplate extends PromptTemplateDefinition {
  templateHash: string;
  templateIdentity: string;
}

export interface ResolvedPromptPack
  extends Omit<PromptPackDefinition, "templates"> {
  packHash: string;
  templates: ResolvedPromptTemplate[];
}
