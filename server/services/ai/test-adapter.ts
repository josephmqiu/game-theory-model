import type { MethodologyPhase } from "../../../shared/types/methodology";
import { PHASE_FIXTURES } from "../../__test-utils__/fixtures";
import { SYNTHESIS_SYSTEM_PROMPT } from "../synthesis-service";
import type { AnalysisActivityCallback } from "./analysis-activity";

interface TestAdapterOptions {
  signal?: AbortSignal;
  onActivity?: AnalysisActivityCallback;
}

function detectPhase(systemPrompt: string): MethodologyPhase {
  const phaseByNumber: Record<string, MethodologyPhase> = {
    "1": "situational-grounding",
    "2": "player-identification",
    "3": "baseline-model",
    "4": "historical-game",
    "6": "formal-modeling",
    "7": "assumptions",
    "8": "elimination",
    "9": "scenarios",
    "10": "meta-check",
  };
  const phaseNumberMatch = systemPrompt.match(
    /\bphase\s*(10|[1-9])\b[:\s]/i,
  );
  if (phaseNumberMatch) {
    const phase = phaseByNumber[phaseNumberMatch[1]];
    if (phase) return phase;
  }

  const phaseNamePatterns: Array<[RegExp, MethodologyPhase]> = [
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

  for (const [pattern, phase] of phaseNamePatterns) {
    if (pattern.test(systemPrompt)) {
      return phase;
    }
  }

  throw new Error("Smoke adapter could not detect analysis phase");
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };

    if (!signal) {
      return;
    }

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function buildResponse(phase: MethodologyPhase) {
  const fixture = PHASE_FIXTURES[phase];
  if (!fixture) {
    throw new Error(`Unsupported smoke-test phase: ${phase}`);
  }

  return JSON.parse(JSON.stringify(fixture));
}

function isSynthesisPrompt(systemPrompt: string): boolean {
  return (
    systemPrompt === SYNTHESIS_SYSTEM_PROMPT ||
    systemPrompt.includes("game-theory analyst synthesizing")
  );
}

function buildSynthesisResponse() {
  return {
    type: "analysis-report",
    executive_summary:
      "The fixture analysis completes the full ladder and points to controlled escalation followed by negotiation.",
    why: "The repeated-game evidence, formal payoff model, assumptions, eliminations, and scenarios all favor costly retaliation over unilateral concession.",
    key_evidence: [
      "Country A imposed steel tariffs",
      "Country B export losses made escalation costly",
    ],
    open_assumptions: [],
    entity_references: [],
    prediction_verdict: null,
    what_would_change: [
      "A credible enforcement mechanism changes retaliation incentives",
    ],
    source_url: null,
    analysis_timestamp: "2026-01-01T00:00:00.000Z",
  };
}

export async function runAnalysisPhase<T = unknown>(
  _prompt: string,
  systemPrompt: string,
  _model: string,
  _schema: Record<string, unknown>,
  options?: TestAdapterOptions,
): Promise<T> {
  if (isSynthesisPrompt(systemPrompt)) {
    options?.onActivity?.({
      kind: "note",
      message: "Smoke adapter executing synthesis",
    });

    await delay(40, options?.signal);

    return buildSynthesisResponse() as T;
  }

  const phase = detectPhase(systemPrompt);

  options?.onActivity?.({
    kind: "note",
    message: `Smoke adapter executing ${phase}`,
  });

  await delay(40, options?.signal);

  return buildResponse(phase) as T;
}
