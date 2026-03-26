import { createHash } from "node:crypto";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PhaseTurnPromptProvenance,
  RunPromptProvenance,
} from "../../shared/types/workspace-state";
import { PHASE_PROMPTS, REVISION_PROMPTS } from "../agents/phase-prompts";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";

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

const TEMPLATE_SET_IDENTITY = "game-theory:phase-prompts";

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
  const supportedPhases = activePhases.filter(
    (phase): phase is SupportedPromptPhase => phase in PHASE_PROMPTS,
  );
  const templateSetHash = hashText(
    supportedPhases
      .map((phase) => `${phase}:${hashText(PHASE_PROMPTS[phase])}`)
      .join("|"),
  );

  return {
    analysisType: "game-theory",
    activePhases,
    templateSetIdentity: TEMPLATE_SET_IDENTITY,
    templateSetHash,
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
  if (!(input.phase in PHASE_PROMPTS)) {
    throw new Error(`Unsupported prompt phase: ${input.phase}`);
  }
  const phase = input.phase as SupportedPromptPhase;
  const systemPrompt = input.revisionSystemPrompt ?? PHASE_PROMPTS[phase];
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
  const templatePrompt =
    variant === "revision" && REVISION_PROMPTS[phase]
      ? REVISION_PROMPTS[phase]
      : PHASE_PROMPTS[phase];

  return {
    system: systemPrompt,
    user: userPrompt,
    promptProvenance: {
      phase,
      templateIdentity: `game-theory:${phase}:${variant}`,
      templateHash: hashText(templatePrompt),
      effectivePromptHash: hashText(`${systemPrompt}\n\n${userPrompt}`),
      variant,
    },
  };
}
