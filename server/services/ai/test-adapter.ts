import type { MethodologyPhase } from "../../../shared/types/methodology";
import { PHASE_FIXTURES } from "../../__test-utils__/fixtures";
import type { AnalysisActivityCallback } from "./analysis-activity";

interface TestAdapterOptions {
  signal?: AbortSignal;
  onActivity?: AnalysisActivityCallback;
}

function detectPhase(systemPrompt: string): MethodologyPhase {
  const phasePatterns: Array<[RegExp, MethodologyPhase]> = [
    [/phase\s*1\b[:\s]|situational[- ]?grounding/i, "situational-grounding"],
    [/phase\s*2\b[:\s]|player[- ]?identification/i, "player-identification"],
    [/phase\s*3\b[:\s]|baseline[- ]?(strategic\s+)?model/i, "baseline-model"],
    [/phase\s*4\b[:\s]|historical[- ]?(repeated\s+)?game/i, "historical-game"],
    [/phase\s*6\b[:\s]|formal[- ]?model/i, "formal-modeling"],
    [/phase\s*7\b[:\s]|\bassumptions\b/i, "assumptions"],
    [/phase\s*8\b[:\s]|\belimination\b/i, "elimination"],
    [/phase\s*9\b[:\s]|\bscenarios\b/i, "scenarios"],
    [/phase\s*10\b[:\s]|meta[- ]?check/i, "meta-check"],
  ];

  for (const [pattern, phase] of phasePatterns) {
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

export async function runAnalysisPhase<T = unknown>(
  _prompt: string,
  systemPrompt: string,
  _model: string,
  _schema: Record<string, unknown>,
  options?: TestAdapterOptions,
): Promise<T> {
  const phase = detectPhase(systemPrompt);

  options?.onActivity?.({
    kind: "note",
    message: `Smoke adapter executing ${phase}`,
  });

  await delay(40, options?.signal);

  return buildResponse(phase) as T;
}
