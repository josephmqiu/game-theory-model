import type {
  EvalFixture,
  TrialResult,
  PhaseEvalReport,
  PhaseArtifact,
  EvalResult,
} from "./eval-types";
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
  chainPerTrial?: boolean; // propagate each trial's output independently (not just trial 0)
  resumeArtifacts?: Map<string, Map<MethodologyPhase, PhaseArtifact>>;
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

export async function runEval(options: EvalOptions): Promise<EvalResult> {
  const {
    fixtures,
    trials = 3,
    efforts = ["medium"],
    provider,
    model,
    fast = false,
    chain = false,
    chainPerTrial = false,
    graderModel,
    resumeArtifacts,
  } = options;

  const runPhase =
    options.runPhaseImpl ??
    (await import("../services/analysis-service")).runPhase;
  const reports: PhaseEvalReport[] = [];
  const artifacts: PhaseArtifact[] = [];

  for (const fixture of fixtures) {
    // Full phase order from the fixture (used for predecessor lookup in resume)
    const allFixturePhases = Object.keys(fixture.phases) as MethodologyPhase[];
    const phaseNames = options.phases
      ? options.phases.filter((p) => p in fixture.phases)
      : allFixturePhases;

    for (const effort of efforts) {
      // Chain state: trial-0-only (existing) + per-trial (new)
      let chainedPriorContext: string | undefined;
      const chainedPerTrial = new Map<number, string>();

      /** Resolve prior context for a given phase and trial index.
       *  Priority: 1) chained output from this run, 2) resumed artifact, 3) fixture static */
      function resolveContext(
        phaseIndex: number,
        trialIndex: number,
      ): string | undefined {
        const phase = phaseNames[phaseIndex];
        // 1. Chained output from earlier phase in this run
        if (chain) {
          if (chainPerTrial && chainedPerTrial.has(trialIndex)) {
            return chainedPerTrial.get(trialIndex);
          }
          if (chainedPriorContext) return chainedPriorContext;
        }
        // 2. Resumed artifact from a previous eval run
        // Use the fixture's full phase list to find the predecessor,
        // so --phase player-identification can resume from situational-grounding
        if (resumeArtifacts) {
          const fixturePhaseIdx = allFixturePhases.indexOf(phase);
          if (fixturePhaseIdx > 0) {
            const predecessorPhase = allFixturePhases[fixturePhaseIdx - 1];
            const artifact = resumeArtifacts
              .get(fixture.name)
              ?.get(predecessorPhase);
            if (artifact) {
              if (chainPerTrial) {
                // Validate trial count match
                if (artifact.trials.length !== trials) {
                  throw new Error(
                    `Per-trial chaining requires matching trial counts. ` +
                      `Artifact "${fixture.name}/${predecessorPhase}" has ${artifact.trials.length} trials ` +
                      `but --trials ${trials} was requested.`,
                  );
                }
                const trialData = artifact.trials.find(
                  (t) => t.trial === trialIndex + 1,
                );
                if (trialData?.success && trialData.entities.length > 0) {
                  return JSON.stringify(trialData.entities);
                }
              } else {
                const trialData = artifact.trials[0];
                if (trialData?.success && trialData.entities.length > 0) {
                  return JSON.stringify(trialData.entities);
                }
              }
            }
          }
        }
        // 3. Fixture static priorContext
        return fixture.priorContext?.[phase];
      }

      for (let phaseIndex = 0; phaseIndex < phaseNames.length; phaseIndex++) {
        const phase = phaseNames[phaseIndex];
        const expectations = fixture.phases[phase]!;
        const trialResults: TrialResult[] = [];

        for (let t = 0; t < trials; t++) {
          // Isolate entity graph state before each trial
          isolateEvalState(fixture.topic);

          try {
            const phaseBrief = resolveContext(phaseIndex, t);
            const start = Date.now();
            const result = await runPhase(phase, fixture.topic, {
              provider,
              model,
              phaseBrief,
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

            const codeResults = runCodeGraders(
              result.entities as any,
              result.relationships as any,
              phase,
              expectations,
              phaseBrief,
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

            // Chain mode: capture output for next phase
            if (chain && result.entities.length > 0) {
              if (chainPerTrial) {
                chainedPerTrial.set(t, JSON.stringify(result.entities));
              }
              // Always capture trial 0 for backwards-compatible chain behavior
              if (t === 0) {
                chainedPriorContext = JSON.stringify(result.entities);
              }
            }
          } finally {
            // Guarantee cleanup even on error
            isolateEvalState();
          }
        }

        // Build artifact for this phase
        artifacts.push({
          artifactVersion: "1.0.0",
          fixture: fixture.name,
          phase,
          effort,
          timestamp: new Date().toISOString(),
          model: model ?? "claude-sonnet-4-20250514",
          trials: trialResults.map((t) => ({
            trial: t.trial,
            success: t.success,
            entities: t.entities,
            relationships: t.relationships,
          })),
        });

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

  return { reports, artifacts };
}
