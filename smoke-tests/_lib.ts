import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SMOKE_READY_FILE_NAME = "smoke-ready.json";
const HOST = "127.0.0.1";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = resolve(ROOT, ".output", "server", "index.mjs");
const ELECTRON_ENTRY = resolve(ROOT, "electron-dist", "main.cjs");
const MCP_PROXY_ENTRY = resolve(ROOT, "dist", "mcp-stdio-proxy.cjs");
const ELECTRON_BINARY = resolve(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);

export interface ManagedProcess {
  child: ChildProcess;
  name: string;
  stderr: string[];
  stdout: string[];
  stop: () => Promise<void>;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function rootPath(...segments: string[]): string {
  return resolve(ROOT, ...segments);
}

export function stateUrl(port: number): string {
  return `http://${HOST}:${port}/api/ai/state`;
}

export function smokeReadyFilePath(userDataDir: string): string {
  return join(userDataDir, SMOKE_READY_FILE_NAME);
}

export function formatLogs(process: ManagedProcess): string {
  const stdout = process.stdout.join("");
  const stderr = process.stderr.join("");
  return [
    `${process.name} stdout:`,
    stdout.length > 0 ? stdout : "(empty)",
    `${process.name} stderr:`,
    stderr.length > 0 ? stderr : "(empty)",
  ].join("\n");
}

export async function makeTempDir(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), `${prefix}-`));
}

export async function cleanupDir(dirPath: string | null | undefined): Promise<void> {
  if (!dirPath) return;
  await rm(dirPath, { recursive: true, force: true });
}

export async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

export async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  options: { intervalMs?: number; message: string; timeoutMs?: number },
): Promise<void> {
  const intervalMs = options.intervalMs ?? 200;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }

  throw new Error(options.message);
}

export async function waitForJsonFile<T>(
  filePath: string,
  timeoutMs = 15_000,
): Promise<T> {
  let parsed: T | null = null;

  await waitFor(
    async () => {
      if (!existsSync(filePath)) {
        return false;
      }

      try {
        const raw = await readFile(filePath, "utf-8");
        parsed = JSON.parse(raw) as T;
        return true;
      } catch {
        return false;
      }
    },
    {
      message: `Timed out waiting for JSON file ${filePath}`,
      timeoutMs,
    },
  );

  return parsed as T;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return JSON.parse(text) as T;
}

export async function waitForHttpOk(url: string, timeoutMs = 15_000): Promise<void> {
  await waitFor(
    async () => {
      try {
        const response = await fetch(url);
        return response.ok;
      } catch {
        return false;
      }
    },
    { message: `Timed out waiting for ${url}`, timeoutMs },
  );
}

export function requireFile(filePath: string, description: string): void {
  assert(
    existsSync(filePath),
    `${description} is missing at ${filePath}. Run the smoke preparation step first.`,
  );
}

export async function startProcess(options: {
  args: string[];
  command: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  name: string;
}): Promise<ManagedProcess> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const child = spawn(options.command, options.args, {
    cwd: options.cwd ?? ROOT,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdout.push(chunk.toString());
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr.push(chunk.toString());
  });

  return {
    child,
    name: options.name,
    stderr,
    stdout,
    stop: async () => {
      if (child.exitCode !== null) {
        return;
      }

      await new Promise<void>((resolveStop) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          child.removeAllListeners("close");
          resolveStop();
        };

        child.once("close", finish);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill("SIGKILL");
          }
          finish();
        }, 5_000);
      });
    },
  };
}

export async function startBuiltServer(options?: {
  extraEnv?: Record<string, string | undefined>;
  mcpPort?: number;
  userDataDir?: string;
}): Promise<{
  baseUrl: string;
  mcpPort: number;
  process: ManagedProcess;
  port: number;
  userDataDir: string;
}> {
  requireFile(SERVER_ENTRY, "Built Nitro server entry");

  const port = await getFreePort();
  const mcpPort = options?.mcpPort ?? (await getFreePort());
  const userDataDir = options?.userDataDir ?? (await makeTempDir("gta-smoke-runtime"));
  const processHandle = await startProcess({
    command: process.execPath,
    args: ["run", SERVER_ENTRY],
    env: {
      GAME_THEORY_ANALYSIS_TEST_MODE: "1",
      GAME_THEORY_ANALYSIS_RUNTIME_ANALYZE_SSE_KEEPALIVE_INTERVAL_MS: "250",
      GAME_THEORY_ANALYZER_USER_DATA_DIR: userDataDir,
      HOST,
      MCP_PORT: String(mcpPort),
      NITRO_HOST: HOST,
      NITRO_PORT: String(port),
      NODE_ENV: "test",
      PORT: String(port),
      ...options?.extraEnv,
    },
    name: "nitro-smoke-server",
  });

  try {
    await waitForHttpOk(stateUrl(port), 20_000);
  } catch (error) {
    await processHandle.stop();
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${formatLogs(processHandle)}`,
    );
  }

  return {
    baseUrl: `http://${HOST}:${port}`,
    mcpPort,
    process: processHandle,
    port,
    userDataDir,
  };
}

export async function startElectronSmokeApp(): Promise<{
  process: ManagedProcess;
  readyFilePath: string;
  userDataDir: string;
}> {
  requireFile(ELECTRON_ENTRY, "Compiled Electron main entry");
  requireFile(ELECTRON_BINARY, "Electron binary");

  const userDataDir = await makeTempDir("gta-smoke-electron");
  const mcpPort = await getFreePort();
  const processHandle = await startProcess({
    command: ELECTRON_BINARY,
    args: [ELECTRON_ENTRY],
    env: {
      ELECTRON_ENABLE_LOGGING: "1",
      GAME_THEORY_ANALYSIS_TEST_MODE: "1",
      GAME_THEORY_ANALYZER_USER_DATA_DIR: userDataDir,
      GAME_THEORY_SMOKE_TEST: "1",
      MCP_PORT: String(mcpPort),
      NODE_ENV: "test",
    },
    name: "electron-smoke-app",
  });

  return {
    process: processHandle,
    readyFilePath: smokeReadyFilePath(userDataDir),
    userDataDir,
  };
}

export function mcpProxyEntryPath(): string {
  return MCP_PROXY_ENTRY;
}

export function electronBinaryPath(): string {
  return ELECTRON_BINARY;
}
