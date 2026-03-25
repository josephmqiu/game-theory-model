import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderHealthCheck } from "../../../shared/types/analysis-runtime";
import { filterCodexEnv } from "../../utils/codex-client";
import {
  buildHealthState,
  classifyAuthCheck,
  CLI_TIMEOUT_MS,
  createCheck,
  runBinaryCommand,
  type ProviderCatalogModel,
  type ProviderProbeResult,
} from "./provider-health";

const CODEX_APP_SERVER_PROBE_TIMEOUT_MS = 1_500;
const CODEX_APP_SERVER_SHUTDOWN_TIMEOUT_MS = 1_000;

function resolveCodexBinaryPath(): string | null {
  const env = filterCodexEnv(process.env as Record<string, string | undefined>);
  const lookup = spawnSync(
    process.platform === "win32" ? "where" : "which",
    ["codex"],
    {
      encoding: "utf-8",
      timeout: CLI_TIMEOUT_MS,
      env,
      ...(process.platform === "win32" ? { shell: true } : {}),
    },
  );
  const binaryPath =
    `${lookup.stdout ?? ""}`.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return binaryPath.length > 0 ? binaryPath : null;
}

async function stopProbeProcess(
  child: import("node:child_process").ChildProcess,
): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      child.removeListener("close", settle);
      resolve();
    };

    child.once("close", settle);

    try {
      child.kill("SIGTERM");
    } catch {
      settle();
      return;
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // Best-effort cleanup only.
        }
      }
      settle();
    }, CODEX_APP_SERVER_SHUTDOWN_TIMEOUT_MS);
  });
}

async function probeCodexRuntime(
  binaryPath: string,
): Promise<{ ok: boolean; message?: string }> {
  const env = filterCodexEnv(process.env as Record<string, string | undefined>);

  return await new Promise((resolve) => {
    const child = spawn(binaryPath, ["app-server"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      ...(process.platform === "win32" ? { shell: true } : {}),
    });

    let settled = false;
    let stderr = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (ok: boolean, message?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.removeAllListeners();
      resolve(ok ? { ok } : { ok, message });
    };

    child.on("error", (error) => {
      settle(false, error.message);
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      const message =
        stderr.trim() ||
        `Codex app-server exited with code ${code ?? "unknown"}`;
      settle(false, message);
    });

    timer = setTimeout(() => {
      settle(true);
      void stopProbeProcess(child);
    }, CODEX_APP_SERVER_PROBE_TIMEOUT_MS);
  });
}

async function loadCodexModels(): Promise<ProviderCatalogModel[]> {
  const cachePath = join(homedir(), ".codex", "models_cache.json");

  try {
    const raw = await readFile(cachePath, "utf-8");
    const cache = JSON.parse(raw) as {
      models?: Array<{
        slug: string;
        display_name: string;
        description: string;
        visibility: string;
        priority: number;
      }>;
    };

    if (!Array.isArray(cache.models)) {
      return [];
    }

    return cache.models
      .filter((model) => model.visibility === "list")
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .map((model) => ({
        value: model.slug,
        displayName: model.display_name,
        description: model.description ?? "",
      }));
  } catch {
    return [];
  }
}

function buildCodexVersionCheck(binaryPath: string): ProviderHealthCheck {
  const env = filterCodexEnv(process.env as Record<string, string | undefined>);
  const result = runBinaryCommand(binaryPath, ["--version"], env);
  if (!result.ok) {
    return createCheck("version", "warn", {
      message: result.error ?? "Unable to read Codex version",
    });
  }

  return createCheck("version", "pass", {
    observedValue: result.stdout,
  });
}

export async function getCodexProviderSnapshot(): Promise<ProviderProbeResult> {
  const binaryPath = resolveCodexBinaryPath();
  if (!binaryPath) {
    return {
      health: buildHealthState("codex", [
        createCheck("binary", "fail", {
          message: "Codex CLI not found",
        }),
        createCheck("version", "unknown"),
        createCheck("auth", "unknown"),
        createCheck("runtime", "unknown"),
        createCheck("models", "unknown"),
      ]),
      models: [],
    };
  }

  const versionCheck = buildCodexVersionCheck(binaryPath);
  const runtime = await probeCodexRuntime(binaryPath);
  const models = await loadCodexModels();
  const authCheck =
    runtime.ok || !runtime.message
      ? createCheck("auth", "unknown")
      : classifyAuthCheck(runtime.message);

  return {
    health: buildHealthState(
      "codex",
      [
        createCheck("binary", "pass", { observedValue: binaryPath }),
        versionCheck,
        authCheck,
        createCheck(
          runtime.ok ? "runtime" : "transport",
          runtime.ok ? "pass" : "warn",
          {
            ...(runtime.message ? { message: runtime.message } : {}),
          },
        ),
        createCheck("models", models.length > 0 ? "pass" : "warn", {
          message:
            models.length > 0
              ? undefined
              : "No Codex models found. Run codex once to populate the model cache.",
        }),
      ],
      {
        binaryPath,
        version:
          versionCheck.status === "pass"
            ? versionCheck.observedValue
            : undefined,
        ...(runtime.ok || !runtime.message ? {} : { message: runtime.message }),
      },
    ),
    models,
  };
}
