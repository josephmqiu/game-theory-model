/**
 * Mock AI adapter for integration tests.
 * Returns fixture data per phase, extracted from the prompt/schema context.
 */

import type { MethodologyPhase } from "../../shared/types/methodology";
import { getPhaseFixture, PHASE_FIXTURES } from "./fixtures";

type PhaseResponses = Partial<
  Record<MethodologyPhase, { entities: unknown[]; relationships: unknown[] }>
>;

/**
 * Detects which phase a runAnalysisPhase call is for by inspecting the prompt/systemPrompt text.
 */
function detectPhaseFromPrompt(prompt: string, systemPrompt?: string): MethodologyPhase | null {
  const phasePatterns: [RegExp, MethodologyPhase][] = [
    [/situational[- ]?grounding|phase\s*1\b/i, "situational-grounding"],
    [/player[- ]?identification|phase\s*2\b/i, "player-identification"],
    [/baseline[- ]?model|phase\s*3\b/i, "baseline-model"],
    [/historical[- ]?game|phase\s*4\b/i, "historical-game"],
    [/formal[- ]?model/i, "formal-modeling"],
    [/assumptions|phase\s*7\b/i, "assumptions"],
    [/elimination|phase\s*8\b/i, "elimination"],
    [/scenarios|phase\s*9\b/i, "scenarios"],
    [/meta[- ]?check|phase\s*10\b/i, "meta-check"],
  ];

  const text = `${prompt}\n${systemPrompt ?? ""}`;
  for (const [pattern, phase] of phasePatterns) {
    if (pattern.test(text)) return phase;
  }
  return null;
}

/**
 * Creates a mock runAnalysisPhase function that returns fixture data per phase.
 * Used with vi.mock to replace the real claude-adapter or codex-adapter.
 */
export function createMockRunAnalysisPhase(
  responses?: PhaseResponses,
) {
  const phaseData = responses ?? PHASE_FIXTURES;

  return async function mockRunAnalysisPhase(
    prompt: string,
    systemPrompt: string,
    _model: string,
    _schema: Record<string, unknown>,
    _options?: unknown,
  ) {
    const phase = detectPhaseFromPrompt(prompt, systemPrompt);
    if (!phase) {
      throw new Error(
        `Mock adapter: could not detect phase from prompt. Prompt starts with: "${prompt.slice(0, 100)}"`,
      );
    }

    const data = phaseData[phase];
    if (!data) {
      throw new Error(
        `Mock adapter: no fixture for phase "${phase}". Available: ${Object.keys(phaseData).join(", ")}`,
      );
    }

    return JSON.parse(JSON.stringify(data));
  };
}

/**
 * Creates a mock that fails on a specific phase with the given error.
 */
export function createFailingMockRunAnalysisPhase(
  failOnPhase: MethodologyPhase,
  error: string | Error = "Mock adapter error",
  responses?: PhaseResponses,
) {
  const phaseData = responses ?? PHASE_FIXTURES;

  return async function mockRunAnalysisPhase(
    prompt: string,
    systemPrompt: string,
    _model: string,
    _schema: Record<string, unknown>,
    _options?: unknown,
  ) {
    const phase = detectPhaseFromPrompt(prompt, systemPrompt);
    if (!phase) {
      throw new Error(
        `Mock adapter: could not detect phase from prompt. Prompt starts with: "${prompt.slice(0, 100)}"`,
      );
    }

    if (phase === failOnPhase) {
      throw typeof error === "string" ? new Error(error) : error;
    }

    const data = phaseData[phase];
    if (!data) {
      throw new Error(`Mock adapter: no fixture for phase "${phase}".`);
    }

    return JSON.parse(JSON.stringify(data));
  };
}
