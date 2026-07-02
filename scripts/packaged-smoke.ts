import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  cleanupDir,
  fetchJson,
  formatLogs,
  getFreePort,
  makeTempDir,
  startProcess,
  stateUrl,
  waitFor,
  waitForJsonFile,
} from "../smoke-tests/_lib";

interface SmokeReadyPayload {
  port: number;
  ready: boolean;
  timestamp: number;
  url: string;
}

interface AnalysisStatePayload {
  analysis: { entities: unknown[] };
  runStatus: { status: string };
  revision: number;
}

interface ManagedCommandResult {
  code: number | null;
  stderr: string;
  stdout: string;
}

const ROOT = resolve(import.meta.dirname, "..");
const DIST_ELECTRON = join(ROOT, "dist-electron");
const GUI_LAUNCH_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

async function runCommand(command: string, args: string[]): Promise<ManagedCommandResult> {
  return await new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", rejectCommand);
    child.on("close", (code) => {
      resolveCommand({ code, stdout, stderr });
    });
  });
}

async function buildPackagedApp(): Promise<void> {
  if (process.env.SKIP_BUILD === "1") {
    console.log("SKIP_BUILD=1 set; using existing packaged app.");
    return;
  }

  console.log("Building packaged macOS arm64 app...");
  const result = await runCommand("bun", ["run", "electron:build:mac-arm64"]);
  if (result.code !== 0) {
    throw new Error(`electron:build:mac-arm64 failed with exit code ${result.code ?? "unknown"}`);
  }
}

async function findAppBundles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const bundles: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      bundles.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) {
      bundles.push(...(await findAppBundles(fullPath)));
    }
  }

  return bundles;
}

async function locatePackagedApp(): Promise<string> {
  const bundles = await findAppBundles(DIST_ELECTRON);
  if (bundles.length === 0) {
    throw new Error(`No .app bundle found under ${DIST_ELECTRON}. Run bun run electron:build:mac-arm64 first.`);
  }

  const withArm64 = bundles.filter((bundle) => bundle.includes("mac-arm64"));
  const candidates = withArm64.length > 0 ? withArm64 : bundles;
  candidates.sort();
  return candidates[0];
}

async function locateAppExecutable(appBundlePath: string): Promise<string> {
  const macOsDir = join(appBundlePath, "Contents", "MacOS");
  const entries = await readdir(macOsDir);

  for (const entry of entries) {
    const candidate = join(macOsDir, entry);
    const info = await stat(candidate);
    if (info.isFile()) {
      return candidate;
    }
  }

  throw new Error(`No executable found in ${macOsDir}`);
}

async function runFixtureAnalysis(baseUrl: string): Promise<AnalysisStatePayload> {
  const analyzeResponse = await fetch(`${baseUrl}/api/ai/analyze`, {
    body: JSON.stringify({
      provider: "anthropic",
      runtime: {
        activePhases: ["situational-grounding", "player-identification"],
        webSearch: false,
      },
      topic: "Smoke test topic",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!analyzeResponse.ok) {
    throw new Error(`Analyze kickoff failed with HTTP ${analyzeResponse.status}: ${await analyzeResponse.text()}`);
  }

  await waitFor(
    async () => {
      const state = await fetchJson<AnalysisStatePayload>(`${baseUrl}/api/ai/state`);
      return state.analysis.entities.length > 0 && state.runStatus.status === "idle";
    },
    {
      message: "Timed out waiting for completed packaged analysis state",
      timeoutMs: 30_000,
    },
  );

  return await fetchJson<AnalysisStatePayload>(`${baseUrl}/api/ai/state`);
}

async function main(): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Packaged smoke is a macOS pre-release check.");
  }

  let userDataDir: string | null = null;
  let processHandle: Awaited<ReturnType<typeof startProcess>> | null = null;

  try {
    await buildPackagedApp();

    const appBundlePath = await locatePackagedApp();
    const executablePath = await locateAppExecutable(appBundlePath);
    if (!existsSync(executablePath)) {
      throw new Error(`Packaged app executable is missing at ${executablePath}`);
    }

    userDataDir = await makeTempDir("gta-packaged-smoke");
    const readyFilePath = join(userDataDir, "smoke-ready.json");
    const mcpPort = await getFreePort();

    processHandle = await startProcess({
      command: executablePath,
      args: [],
      env: {
        ELECTRON_ENABLE_LOGGING: "1",
        GAME_THEORY_ANALYSIS_TEST_MODE: "1",
        GAME_THEORY_ANALYZER_USER_DATA_DIR: userDataDir,
        GAME_THEORY_SMOKE_TEST: "1",
        MCP_PORT: String(mcpPort),
        NODE_ENV: "test",
        PATH: GUI_LAUNCH_PATH,
      },
      name: "packaged-smoke-app",
    });

    const ready = await waitForJsonFile<SmokeReadyPayload>(readyFilePath, 45_000);
    if (!ready.ready) {
      throw new Error(`Smoke readiness file did not report ready=true: ${JSON.stringify(ready)}`);
    }

    const initialState = await fetchJson<AnalysisStatePayload>(stateUrl(ready.port));
    if (initialState.runStatus.status !== "idle") {
      throw new Error(`Expected idle run status, got ${initialState.runStatus.status}`);
    }

    const finalState = await runFixtureAnalysis(`http://127.0.0.1:${ready.port}`);
    if (finalState.analysis.entities.length === 0) {
      throw new Error("Packaged fixture analysis completed without entities");
    }

    const summary = {
      ok: true,
      appBundle: appBundlePath,
      entities: finalState.analysis.entities.length,
      mcpPort,
      pathBootstrap:
        "packaged app launched with PATH=/usr/bin:/bin:/usr/sbin:/sbin and served the test-mode analysis fixture",
      port: ready.port,
      rendererUrl: ready.url,
      revision: finalState.revision,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("PASS packaged smoke");
  } catch (error) {
    const details =
      processHandle === null
        ? error instanceof Error
          ? error.message
          : String(error)
        : `${error instanceof Error ? error.message : String(error)}\n${formatLogs(processHandle)}`;
    console.error(details);
    console.error("FAIL packaged smoke");
    process.exitCode = 1;
  } finally {
    if (processHandle) {
      await processHandle.stop();
    }
    await cleanupDir(userDataDir);
  }
}

await main();
