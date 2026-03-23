/**
 * Mock AI adapter for integration tests.
 * Returns fixture data per phase, extracted from the prompt/schema context.
 */

import type { MethodologyPhase } from "../../shared/types/methodology";
import { PHASE_FIXTURES } from "./fixtures";

type PhaseResponses = Partial<
  Record<MethodologyPhase, { entities: unknown[]; relationships: unknown[] }>
>;

/**
 * Detects which phase a runAnalysisPhase call is for.
 * Checks the system prompt first (contains "Phase N: Name" header),
 * then falls back to the user prompt.
 */
function detectPhaseFromPrompt(prompt: string, systemPrompt?: string): MethodologyPhase | null {
  // Phase number patterns — unambiguous, checked against systemPrompt first
  const phaseNumberPatterns: [RegExp, MethodologyPhase][] = [
    [/phase\s*1\b[:\s]/i, "situational-grounding"],
    [/phase\s*2\b[:\s]/i, "player-identification"],
    [/phase\s*3\b[:\s]/i, "baseline-model"],
    [/phase\s*4\b[:\s]/i, "historical-game"],
    [/phase\s*6\b[:\s]/i, "formal-modeling"],
    [/phase\s*7\b[:\s]/i, "assumptions"],
    [/phase\s*8\b[:\s]/i, "elimination"],
    [/phase\s*9\b[:\s]/i, "scenarios"],
    [/phase\s*10\b[:\s]/i, "meta-check"],
  ];

  // Check system prompt first — it has the canonical "Phase N:" header
  if (systemPrompt) {
    for (const [pattern, phase] of phaseNumberPatterns) {
      if (pattern.test(systemPrompt)) return phase;
    }
  }

  // Fallback: check phase names in combined text
  const namePatterns: [RegExp, MethodologyPhase][] = [
    [/situational[- ]?grounding/i, "situational-grounding"],
    [/player[- ]?identification/i, "player-identification"],
    [/baseline[- ]?(strategic\s+)?model/i, "baseline-model"],
    [/historical[- ]?(repeated\s+)?game/i, "historical-game"],
    [/formal[- ]?model/i, "formal-modeling"],
    [/\bassumptions\b/i, "assumptions"],
    [/\belimination\b/i, "elimination"],
    [/\bscenarios\b/i, "scenarios"],
    [/meta[- ]?check/i, "meta-check"],
  ];

  const text = systemPrompt ?? prompt;
  for (const [pattern, phase] of namePatterns) {
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
