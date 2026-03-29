import {
  cleanupDir,
  fetchJson,
  formatLogs,
  runtimeDiagnosticsUrl,
  startElectronSmokeApp,
  waitForJsonFile,
} from "./_lib";

interface SmokeReadyPayload {
  port: number;
  ready: boolean;
  timestamp: number;
  url: string;
}

async function main(): Promise<void> {
  let userDataDir: string | null = null;
  let processHandle: Awaited<ReturnType<typeof startElectronSmokeApp>>["process"] | null = null;

  try {
    const started = await startElectronSmokeApp();
    userDataDir = started.userDataDir;
    processHandle = started.process;

    const ready = await waitForJsonFile<SmokeReadyPayload>(started.readyFilePath, 25_000);
    if (!ready.ready) {
      throw new Error(`Smoke readiness file did not report ready=true: ${JSON.stringify(ready)}`);
    }

    const diagnostics = await fetchJson<{
      recent: Array<{ code: string }>;
    }>(runtimeDiagnosticsUrl(ready.port));

    if (!ready.url.endsWith("/editor")) {
      throw new Error(`Unexpected renderer URL in smoke readiness payload: ${ready.url}`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        port: ready.port,
        rendererUrl: ready.url,
        diagnosticCount: diagnostics.recent.length,
      }),
    );
  } catch (error) {
    const details =
      processHandle === null
        ? error instanceof Error
          ? error.message
          : String(error)
        : `${error instanceof Error ? error.message : String(error)}\n${formatLogs(processHandle)}`;
    console.error(details);
    process.exitCode = 1;
  } finally {
    if (processHandle) {
      await processHandle.stop();
    }
    await cleanupDir(userDataDir);
  }
}

await main();
