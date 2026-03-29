import type { EvalFixture, TrialResult, PhaseEvalReport } from "./eval-types";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../shared/types/methodology";
import { runCodeGraders } from "./code-graders";
import { runModelGraders } from "./model-graders";
import * as entityGraphService from "../services/entity-graph-service";
import { _resetLoopbackTriggersForTest } from "../services/analysis-tools";

type RunPhaseImpl = typeof import("../services/analysis-service").runPhase;

export interface EvalOptions {
  fixtures: EvalFixture[];
  phases?: MethodologyPhase[];
  efforts?: AnalysisEffortLevel[];
  trials?: number;
  provider?: string;
  model?: string;
  graderModel?: string; // model for rubric grading (default: opus)
  fast?: boolean; // skip model graders
  chain?: boolean; // feed phase output as prior context to next phase
  runPhaseImpl?: RunPhaseImpl;
}

/** Reset all mutable module-level state between eval trials. */
function isolateEvalState(topic?: string): void {
  entityGraphService._resetForTest();
  _resetLoopbackTriggersForTest();
  if (topic) {
    entityGraphService.newAnalysis(topic);
  }
}

export async function runEval(
  options: EvalOptions,
): Promise<PhaseEvalReport[]> {
  const {
    fixtures,
    trials = 3,
    efforts = ["medium"],
    provider,
    model,
    fast = false,
    chain = false,
    graderModel,
  } = options;

  const runPhase =
    options.runPhaseImpl ??
    (await import("../services/analysis-service")).runPhase;
  const reports: PhaseEvalReport[] = [];

  for (const fixture of fixtures) {
    const phaseNames = options.phases
      ? options.phases.filter((p) => p in fixture.phases)
      : (Object.keys(fixture.phases) as MethodologyPhase[]);

    for (const effort of efforts) {
      let chainedPriorContext: string | undefined;

      for (const phase of phaseNames) {
        const expectations = fixture.phases[phase]!;
        const trialResults: TrialResult[] = [];

        for (let t = 0; t < trials; t++) {
          // Isolate entity graph state before each trial
          isolateEvalState(fixture.topic);

          try {
            const start = Date.now();
            const result = await runPhase(phase, fixture.topic, {
              provider,
              model,
              phaseBrief: chain
                ? chainedPriorContext
                : fixture.priorContext?.[phase],
              runtime: { webSearch: false, effortLevel: effort },
            });
            const latencyMs = Date.now() - start;

            if (!result.success) {
              trialResults.push({
                fixture: fixture.name,
                phase,
                effort,
                trial: t + 1,
                success: false,
                entityCount: 0,
                entityTypes: {},
                entities: [],
                relationships: [],
                graderResults: [],
                latencyMs,
                error: result.error,
              });
              continue;
            }

            const priorCtx = chain
              ? chainedPriorContext
              : fixture.priorContext?.[phase];
            const codeResults = runCodeGraders(
              result.entities as any,
              result.relationships as any,
              phase,
              expectations,
              priorCtx,
            );

            const modelResults = fast
              ? []
              : await runModelGraders(
                  result.entities,
                  phase,
                  expectations.rubrics,
                  { model: graderModel, relationships: result.relationships },
                );

            const allGraders = [...codeResults, ...modelResults];

            const entityTypes: Record<string, number> = {};
            for (const e of result.entities as any[]) {
              entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
            }

            trialResults.push({
              fixture: fixture.name,
              phase,
              effort,
              trial: t + 1,
              success: true,
              entityCount: result.entities.length,
              entityTypes,
              entities: result.entities,
              relationships: result.relationships,
              graderResults: allGraders,
              latencyMs,
              transcript: result.assistantResponse,
            });

            // Chain mode: capture first trial's output for next phase.
            // Only trial 0 — subsequent trials reuse this context intentionally
            // to test prompt quality against stable input.
            if (chain && t === 0 && result.entities.length > 0) {
              chainedPriorContext = JSON.stringify(result.entities);
            }
          } finally {
            // Guarantee cleanup even on error
            isolateEvalState();
          }
        }

        const trialsPassed = trialResults.filter(
          (t) => t.success && t.graderResults.every((g) => g.passed),
        );
        const passRate = trialsPassed.length / trials;
        const allPass = trialsPassed.length === trials;

        // Aggregate metrics (Anthropic best practices: pass@k, SEM, CI)
        const passAtK = 1 - (1 - passRate) ** trials;
        const passHatK = passRate ** trials;
        const sem = Math.sqrt((passRate * (1 - passRate)) / trials);
        const ci95: [number, number] = [
          Math.max(0, passRate - 1.96 * sem),
          Math.min(1, passRate + 1.96 * sem),
        ];

        const latencies = trialResults.map((t) => t.latencyMs);
        const sortedLatencies = [...latencies].sort((a, b) => a - b);
        const meanLatencyMs =
          latencies.reduce((s, v) => s + v, 0) / latencies.length;
        const medianLatencyMs =
          sortedLatencies.length % 2 === 0
            ? (sortedLatencies[sortedLatencies.length / 2 - 1] +
                sortedLatencies[sortedLatencies.length / 2]) /
              2
            : sortedLatencies[Math.floor(sortedLatencies.length / 2)];

        reports.push({
          fixture: fixture.name,
          phase,
          effort,
          trials: trialResults,
          passRate,
          allPass,
          passAtK,
          passHatK,
          sem,
          ci95,
          meanLatencyMs,
          medianLatencyMs,
        });
      }
    }
  }

  return reports;
}
