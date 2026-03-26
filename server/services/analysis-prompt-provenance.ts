import { createHash } from "node:crypto";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PhaseTurnPromptProvenance,
  RunPromptProvenance,
} from "../../shared/types/workspace-state";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import {
  resolveAnalysisPromptTemplate,
  resolvePromptPack,
} from "./prompt-pack-registry";

type SupportedPromptPhase = Extract<
  MethodologyPhase,
  | "situational-grounding"
  | "player-identification"
  | "baseline-model"
  | "historical-game"
  | "formal-modeling"
  | "assumptions"
  | "elimination"
  | "scenarios"
  | "meta-check"
>;

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildAnalysisEffortGuidance(
  effortLevel: AnalysisEffortLevel,
): string {
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
    analysisType: "game-theory",
    mode: "analysis-runtime",
  });
  const supportedInitialPhases = new Set(
    promptPack.templates
      .filter((template) => template.variant === "initial")
      .map((template) => template.phase),
  );
  const supportedPhases = activePhases.filter(
    (phase): phase is SupportedPromptPhase => supportedInitialPhases.has(phase),
  );

  return {
    analysisType: "game-theory",
    activePhases: supportedPhases,
    promptPackId: promptPack.id,
    promptPackVersion: promptPack.version,
    promptPackMode: promptPack.mode,
    templateSetIdentity: promptPack.id,
    templateSetHash: promptPack.packHash,
  };
}

export function buildPhasePromptBundle(input: {
  phase: MethodologyPhase;
  topic: string;
  effortLevel: AnalysisEffortLevel;
  priorContext?: string;
  revisionRetryInstruction?: string;
  revisionSystemPrompt?: string;
}): {
  system: string;
  user: string;
  promptProvenance: PhaseTurnPromptProvenance;
} {
  const phase = input.phase as SupportedPromptPhase;
  const parts = [
    `Analyze the following topic:\n\n${input.topic}`,
    [
      "Analysis-mode tool guidance:",
      "- Use web search to verify current, time-sensitive facts before finalizing entities.",
      "- Use get_entity, query_entities, and query_relationships to inspect prior analytical state when helpful.",
      "- If you detect a disruption trigger, call request_loopback(trigger_type, justification).",
      "- Return only the final JSON object that matches the schema.",
    ].join("\n"),
    buildAnalysisEffortGuidance(input.effortLevel),
  ];

  if (input.priorContext) {
    parts.push(
      `\nPrior phase output (use as context, reference entity ids where relevant):\n\n${input.priorContext}`,
    );
  }

  if (input.revisionRetryInstruction) {
    parts.push(
      `\nRevision retry instruction:\n\n${input.revisionRetryInstruction}`,
    );
  }

  const userPrompt = parts.join("\n");
  const variant =
    input.revisionSystemPrompt || input.revisionRetryInstruction
      ? "revision"
      : "initial";
  const resolvedTemplate = resolveAnalysisPromptTemplate({
    analysisType: "game-theory",
    mode: "analysis-runtime",
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
      phase,
      templateIdentity: resolvedTemplate.templateIdentity,
      templateHash: resolvedTemplate.templateHash,
      effectivePromptHash: hashText(`${systemPrompt}\n\n${userPrompt}`),
      variant,
    },
  };
}
