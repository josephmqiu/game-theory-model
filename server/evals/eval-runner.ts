import type { EvalFixture, TrialResult, PhaseEvalReport } from "./eval-types";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../shared/types/methodology";
import { runCodeGraders } from "./code-graders";
import { runModelGraders } from "./model-graders";

export interface EvalOptions {
  fixtures: EvalFixture[];
  phases?: MethodologyPhase[];
  efforts?: AnalysisEffortLevel[];
  trials?: number;
  provider?: string;
  model?: string;
  fast?: boolean; // skip model graders
  chain?: boolean; // feed phase output as prior context to next phase
}

export async function runEval(
  options: EvalOptions,
): Promise<PhaseEvalReport[]> {
  const {
    fixtures,
    trials = 3,
    efforts = ["standard"],
    provider,
    model,
    fast = false,
    chain = false,
  } = options;

  const { runPhase } = await import("../services/analysis-service");
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
          const start = Date.now();
          const result = await runPhase(phase, fixture.topic, {
            provider,
            model,
            priorEntities: chain ? chainedPriorContext : undefined,
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
              graderResults: [],
              latencyMs,
              error: result.error,
            });
            continue;
          }

          const codeResults = runCodeGraders(
            result.entities as any,
            result.relationships as any,
            phase,
            expectations,
          );

          const modelResults = fast
            ? []
            : await runModelGraders(
                result.entities,
                phase,
                expectations.rubrics,
                { provider, model },
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
            graderResults: allGraders,
            latencyMs,
          });

          // Chain mode: capture first trial's output for next phase.
          // Only trial 0 — subsequent trials reuse this context intentionally
          // to test prompt quality against stable input.
          if (chain && t === 0 && result.entities.length > 0) {
            chainedPriorContext = JSON.stringify(result.entities);
          }
        }

        const trialsPassed = trialResults.filter(
          (t) => t.success && t.graderResults.every((g) => g.passed),
        );
        const passRate = trialsPassed.length / trials;
        const allPass = trialsPassed.length === trials;

        reports.push({
          fixture: fixture.name,
          phase,
          effort,
          trials: trialResults,
          passRate,
          allPass,
        });
      }
    }
  }

  return reports;
}
