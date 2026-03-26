import { createHash } from "node:crypto";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PromptPackDefinition,
  PromptPackMode,
  PromptTemplateVariant,
  ResolvedPromptPack,
  ResolvedPromptTemplate,
} from "../../shared/types/prompt-pack";
import { GAME_THEORY_ANALYSIS_PROMPT_PACK } from "../agents/phase-prompts";

const BUNDLED_PROMPT_PACKS: PromptPackDefinition[] = [
  GAME_THEORY_ANALYSIS_PROMPT_PACK,
];

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function packRegistryKey(analysisType: string, mode: PromptPackMode): string {
  return `${analysisType}:${mode}`;
}

function resolvePromptTemplates(
  pack: PromptPackDefinition,
): ResolvedPromptTemplate[] {
  return pack.templates.map((template) => ({
    ...template,
    templateHash: hashText(template.text),
    templateIdentity: `${pack.id}:${template.phase}:${template.variant}`,
  }));
}

function resolvePack(pack: PromptPackDefinition): ResolvedPromptPack {
  const templates = resolvePromptTemplates(pack);
  const packHash = hashText(
    JSON.stringify({
      id: pack.id,
      version: pack.version,
      mode: pack.mode,
      analysisType: pack.analysisType,
      templates: templates.map((template) => ({
        phase: template.phase,
        variant: template.variant,
        templateHash: template.templateHash,
      })),
    }),
  );

  return {
    ...pack,
    templates,
    packHash,
  };
}

const RESOLVED_PROMPT_PACKS = BUNDLED_PROMPT_PACKS.map(resolvePack);

const PROMPT_PACKS_BY_KEY = new Map(
  RESOLVED_PROMPT_PACKS.map((pack) => [
    packRegistryKey(pack.analysisType, pack.mode),
    pack,
  ]),
);

export function resolvePromptPack(input: {
  analysisType: string;
  mode: PromptPackMode;
}): ResolvedPromptPack {
  const pack = PROMPT_PACKS_BY_KEY.get(
    packRegistryKey(input.analysisType, input.mode),
  );

  if (!pack) {
    throw new Error(
      `Unsupported prompt pack for analysisType "${input.analysisType}" and mode "${input.mode}".`,
    );
  }

  return pack;
}

export function resolveAnalysisPromptTemplate(input: {
  analysisType: string;
  mode: PromptPackMode;
  phase: MethodologyPhase;
  variant: PromptTemplateVariant;
}): ResolvedPromptTemplate & { pack: ResolvedPromptPack } {
  const pack = resolvePromptPack({
    analysisType: input.analysisType,
    mode: input.mode,
  });
  const template = pack.templates.find(
    (candidate) =>
      candidate.phase === input.phase && candidate.variant === input.variant,
  );

  if (!template) {
    throw new Error(
      `Unsupported prompt template for phase "${input.phase}" and variant "${input.variant}" in pack "${pack.id}@${pack.version}".`,
    );
  }

  return {
    ...template,
    pack,
  };
}
