import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runEval } from "./eval-runner";
import type { EvalFixture, PhaseEvalReport } from "./eval-types";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import { normalizeRuntimeEffort } from "../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../shared/types/methodology";

const __dirname = new URL(".", import.meta.url).pathname;
const FIXTURES_DIR = join(__dirname, "fixtures");
const RESULTS_DIR = join(__dirname, "results");

export function parseArgs(): {
  fixture?: string;
  phase?: string;
  effort?: string;
  trials: number;
  fast: boolean;
  chain: boolean;
  provider?: string;
  model?: string;
  graderModel?: string;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  let fast = false;
  let chain = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fast") {
      fast = true;
      continue;
    }
    if (args[i] === "--chain") {
      chain = true;
      continue;
    }
    if (args[i].startsWith("--") && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  return {
    fixture: parsed.fixture,
    phase: parsed.phase,
    effort: parsed.effort,
    trials: parseInt(parsed.trials ?? "3", 10),
    fast,
    chain,
    provider: parsed.provider,
    model: parsed.model,
    graderModel: parsed["grader-model"],
  };
}

export function loadFixtures(filterName?: string): EvalFixture[] {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  const fixtures: EvalFixture[] = [];
  for (const file of files) {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, file), "utf8"),
    ) as EvalFixture;
    if (
      !filterName ||
      fixture.name === filterName ||
      filterName.split(",").includes(fixture.name)
    ) {
      fixtures.push(fixture);
    }
  }
  return fixtures;
}

function formatReport(report: PhaseEvalReport): string {
  const lines: string[] = [];
  lines.push(
    `\n${report.fixture} / ${report.phase} (effort: ${report.effort})`,
  );

  for (const trial of report.trials) {
    const graderSummary = trial.graderResults
      .filter((g) => !g.passed)
      .map((g) => g.grader)
      .join(", ");

    const status = !trial.success
      ? `ERROR: ${trial.error}`
      : trial.graderResults.every((g) => g.passed)
        ? "PASS"
        : `FAIL (${graderSummary})`;

    const types = Object.entries(trial.entityTypes)
      .map(([t, c]) => `${c} ${t}`)
      .join(", ");

    lines.push(
      `  Trial ${trial.trial}: ${trial.entityCount} entities (${types})  ${status}  [${(trial.latencyMs / 1000).toFixed(1)}s]`,
    );
  }

  const passRatePct = (report.passRate * 100).toFixed(0);
  const consistency = report.allPass ? "ALL PASS" : "INCONSISTENT";
  lines.push(
    `  pass rate: ${passRatePct}% (${report.trials.length} trials)  ${consistency}`,
  );

  // Aggregate metrics
  if (report.passAtK != null) {
    const passAtKPct = (report.passAtK * 100).toFixed(1);
    const passHatKPct = ((report.passHatK ?? 0) * 100).toFixed(1);
    const semStr = (report.sem ?? 0).toFixed(3);
    const ci = report.ci95 ?? [0, 0];
    lines.push(
      `  pass@${report.trials.length}: ${passAtKPct}%  pass^${report.trials.length}: ${passHatKPct}%  SEM: ${semStr}  95% CI: [${(ci[0] * 100).toFixed(0)}%, ${(ci[1] * 100).toFixed(0)}%]`,
    );
  }
  if (report.meanLatencyMs != null) {
    lines.push(
      `  latency: mean=${(report.meanLatencyMs / 1000).toFixed(1)}s  median=${((report.medianLatencyMs ?? 0) / 1000).toFixed(1)}s`,
    );
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs();
  const fixtures = loadFixtures(args.fixture);

  if (fixtures.length === 0) {
    console.error(
      `No fixtures found${args.fixture ? ` matching "${args.fixture}"` : ""}`,
    );
    console.error(`Fixture directory: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const efforts: AnalysisEffortLevel[] = args.effort
    ? args.effort
        .split(",")
        .map((effort) => normalizeRuntimeEffort(effort as never))
        .filter((effort): effort is AnalysisEffortLevel => Boolean(effort))
    : ["medium"];

  const phases: MethodologyPhase[] | undefined = args.phase
    ? (args.phase.split(",") as MethodologyPhase[])
    : undefined;

  console.log(
    `Running eval: ${fixtures.length} fixture(s), ${efforts.length} effort level(s), ${args.trials} trial(s)${args.fast ? " [fast mode]" : ""}${args.chain ? " [chain mode]" : ""}\n`,
  );

  const reports = await runEval({
    fixtures,
    phases,
    efforts,
    trials: args.trials,
    fast: args.fast,
    chain: args.chain,
    provider: args.provider,
    model: args.model,
    graderModel: args.graderModel,
  });

  for (const report of reports) {
    console.log(formatReport(report));
  }

  // Save results with metadata envelope
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evalDir = join(RESULTS_DIR, `eval-${timestamp}`);
  mkdirSync(evalDir, { recursive: true });

  const evalMeta = {
    timestamp: new Date().toISOString(),
    model: args.model ?? "claude-sonnet-4-20250514",
    graderModel: args.graderModel ?? "claude-opus-4-20250514",
    efforts,
    trials: args.trials,
    fast: args.fast,
    chain: args.chain,
    evalVersion: "2.0.0",
  };

  writeFileSync(
    join(evalDir, "report.json"),
    JSON.stringify({ evalMeta, reports }, null, 2),
  );

  // Save transcripts per trial
  const transcriptsDir = join(evalDir, "transcripts");
  let hasTranscripts = false;
  for (const report of reports) {
    for (const trial of report.trials) {
      if (trial.transcript) {
        if (!hasTranscripts) {
          mkdirSync(transcriptsDir, { recursive: true });
          hasTranscripts = true;
        }
        writeFileSync(
          join(
            transcriptsDir,
            `${report.fixture}--${report.phase}--trial-${trial.trial}.txt`,
          ),
          trial.transcript,
        );
      }
    }
  }

  console.log(`\nResults saved to ${evalDir}`);
}

// Only run main() when executed directly (not imported in tests)
if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error("Eval failed:", err);
    process.exit(1);
  });
}
