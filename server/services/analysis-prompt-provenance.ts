import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PhaseTurnPromptProvenance,
  RunPromptProvenance,
} from "../../shared/types/workspace-state";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import {
  DEFAULT_ANALYSIS_TYPE,
  DEFAULT_PROMPT_PACK_MODE,
  type PromptPackPhaseConfig,
  type PromptTemplateVariant,
} from "../../shared/types/prompt-pack";
import {
  resolveAnalysisPromptTemplate,
  resolvePromptPack,
} from "./prompt-pack-registry";
import { hashText } from "../utils/hash-text";

function resolvePhaseConfig(phase: MethodologyPhase): PromptPackPhaseConfig {
  const promptPack = resolvePromptPack({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: DEFAULT_PROMPT_PACK_MODE,
  });
  const config = promptPack.phases?.find((entry) => entry.phase === phase);
  if (!config) {
    throw new Error(`Prompt pack is missing phase config for "${phase}".`);
  }
  return config;
}

function buildAnalysisEffortGuidance(effortLevel: AnalysisEffortLevel): string {
  const guidanceByEffort: Record<AnalysisEffortLevel, string[]> = {
    low: [
      "Analysis effort guidance:",
      '- Effort level: "low".',
      "- Prioritize core players, objectives, strategic structure, and the minimum research needed for a useful answer.",
      "- Avoid unnecessary branching or long-tail possibilities.",
      "- Prefer concise outputs when uncertainty is high.",
    ],
    medium: [
      "Analysis effort guidance:",
      '- Effort level: "medium".',
      "- Preserve the current expected level of depth and research coverage.",
      "- Focus on the main strategic structure without expanding scope unnecessarily.",
      "- Keep uncertainty visible, but do not add extra alternatives unless they materially help the analysis.",
    ],
    high: [
      "Analysis effort guidance:",
      '- Effort level: "high".',
      "- Allow broader research and comparison when it materially improves the analysis.",
      "- Surface more alternatives, assumptions, and uncertainty explicitly.",
      "- Spend more attention on edge cases and competing explanations.",
    ],
    max: [
      "Analysis effort guidance:",
      '- Effort level: "max".',
      "- Use the broadest research and comparison budget available when it materially improves the analysis.",
      "- Surface alternatives, uncertainty, and edge cases explicitly.",
      "- Prefer completeness over brevity when the evidence supports it.",
    ],
  };

  return guidanceByEffort[effortLevel].join("\n");
}

export function createRunPromptProvenance(
  activePhases: MethodologyPhase[],
): RunPromptProvenance {
  const promptPack = resolvePromptPack({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: DEFAULT_PROMPT_PACK_MODE,
  });
  const supportedInitialPhases = new Set(
    promptPack.templates
      .filter((template) => template.variant === "initial")
      .map((template) => template.phase),
  );
  const supportedPhases = activePhases.filter((phase) =>
    supportedInitialPhases.has(phase),
  );

  return {
    analysisType: DEFAULT_ANALYSIS_TYPE,
    activePhases: supportedPhases,
    promptPackId: promptPack.id,
    promptPackVersion: promptPack.version,
    promptPackMode: promptPack.mode,
    promptPackSource: promptPack.source,
    templateSetIdentity: promptPack.id,
    templateSetHash: promptPack.packHash,
    toolPolicyByPhase: Object.fromEntries(
      (promptPack.phases ?? [])
        .filter((config) => supportedPhases.includes(config.phase))
        .map((config) => [config.phase, config.toolPolicy]),
    ) as RunPromptProvenance["toolPolicyByPhase"],
  };
}

export function buildPhasePromptBundle(input: {
  phase: MethodologyPhase;
  topic: string;
  effortLevel: AnalysisEffortLevel;
  phaseBrief?: string;
  revisionRetryInstruction?: string;
  revisionSystemPrompt?: string;
  /** @deprecated No-op, kept for call-site compatibility during migration. */
  toolBased?: boolean;
}): {
  system: string;
  user: string;
  promptProvenance: PhaseTurnPromptProvenance;
  toolPolicy: PromptPackPhaseConfig["toolPolicy"];
} {
  const phase = input.phase;
  const phaseConfig = resolvePhaseConfig(phase);
  const toolGuidanceLines = [
    "Analysis-mode tool guidance:",
    `- Available analysis tools: ${phaseConfig.toolPolicy.enabledAnalysisTools.join(", ")}.`,
    phaseConfig.toolPolicy.webSearch === false
      ? "- Web search is disabled for this phase. Rely on graph-query tools and existing grounded facts."
      : "- Use web search to verify current, time-sensitive facts before finalizing entities.",
    "- Use get_entity, query_entities, and query_relationships to inspect prior analytical state when helpful.",
    "- If you detect a disruption trigger, call request_loopback(trigger_type, justification).",
  ];
  const parts = [
    `Analyze the following topic:\n\n${input.topic}`,
    toolGuidanceLines.join("\n"),
    buildAnalysisEffortGuidance(input.effortLevel),
  ];

  if (input.phaseBrief) {
    parts.push(
      `\nCompact phase brief (use this as orientation, then query tools for full context):\n\n${input.phaseBrief}`,
    );
  }

  if (input.revisionRetryInstruction) {
    parts.push(
      `\nRevision retry instruction:\n\n${input.revisionRetryInstruction}`,
    );
  }

  const userPrompt = parts.join("\n");
  const variant: PromptTemplateVariant =
    input.revisionSystemPrompt || input.revisionRetryInstruction
      ? "revision"
      : "initial";
  const resolvedTemplate = resolveAnalysisPromptTemplate({
    analysisType: DEFAULT_ANALYSIS_TYPE,
    mode: DEFAULT_PROMPT_PACK_MODE,
    phase,
    variant,
  });
  const systemPrompt = input.revisionSystemPrompt ?? resolvedTemplate.text;

  return {
    system: systemPrompt,
    user: userPrompt,
    promptProvenance: {
      promptPackId: resolvedTemplate.pack.id,
      promptPackVersion: resolvedTemplate.pack.version,
      promptPackMode: resolvedTemplate.pack.mode,
      promptPackSource: resolvedTemplate.pack.source,
      phase,
      templateIdentity: resolvedTemplate.templateIdentity,
      templateHash: resolvedTemplate.templateHash,
      effectivePromptHash: hashText(`${systemPrompt}\n\n${userPrompt}`),
      variant,
      toolPolicy: phaseConfig.toolPolicy,
      doneCondition: phaseConfig.doneCondition,
    },
    toolPolicy: phaseConfig.toolPolicy,
  };
}
