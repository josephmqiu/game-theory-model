import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ProviderHealthCheck,
  ProviderHealthReason,
  ProviderHealthState,
  RuntimeProvider,
} from "../../../shared/types/analysis-runtime";
import { filterCodexEnv } from "../../utils/codex-client";
import { resolveClaudeCli } from "../../utils/resolve-claude-cli";
import {
  buildClaudeAgentEnv,
  getClaudeAgentDebugFilePath,
} from "../../utils/resolve-claude-agent-env";

export interface ProviderCatalogModel {
  value: string;
  displayName: string;
  description: string;
}

export interface ProviderProbeResult {
  health: ProviderHealthState;
  models: ProviderCatalogModel[];
}

const CLI_TIMEOUT_MS = 5_000;
const CODEX_APP_SERVER_PROBE_TIMEOUT_MS = 1_500;
const CODEX_APP_SERVER_SHUTDOWN_TIMEOUT_MS = 1_000;

const FALLBACK_CLAUDE_MODELS: ProviderCatalogModel[] = [
  {
    value: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    description: "",
  },
  {
    value: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    description: "",
  },
  {
    value: "claude-sonnet-4-5-20250514",
    displayName: "Claude Sonnet 4.5",
    description: "",
  },
  {
    value: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    description: "",
  },
  {
    value: "claude-3-7-sonnet-20250219",
    displayName: "Claude 3.7 Sonnet",
    description: "",
  },
  {
    value: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    description: "",
  },
  {
    value: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    description: "",
  },
];

function createCheck(
  name: ProviderHealthCheck["name"],
  status: ProviderHealthCheck["status"],
  options: {
    message?: string;
    observedValue?: string;
  } = {},
): ProviderHealthCheck {
  return {
    name,
    status,
    ...(options.message ? { message: options.message } : {}),
    ...(options.observedValue ? { observedValue: options.observedValue } : {}),
  };
}

function buildHealthState(
  provider: RuntimeProvider,
  checks: ProviderHealthCheck[],
  options: {
    binaryPath?: string;
    version?: string;
    message?: string;
  } = {},
): ProviderHealthState {
  const failedCheck = checks.find((check) => check.status === "fail");
  const warnedCheck = checks.find((check) => check.status === "warn");

  let status: ProviderHealthState["status"] = "healthy";
  let reason: ProviderHealthReason | null = null;
  let message = options.message;

  if (failedCheck) {
    status = failedCheck.name === "binary" ? "unavailable" : "degraded";
    reason = mapReasonFromCheck(failedCheck);
    message = message ?? failedCheck.message;
  } else if (warnedCheck) {
    status = "degraded";
    reason = mapReasonFromCheck(warnedCheck);
    message = message ?? warnedCheck.message;
  }

  return {
    provider,
    status,
    reason,
    checkedAt: Date.now(),
    ...(message ? { message } : {}),
    ...(options.binaryPath ? { binaryPath: options.binaryPath } : {}),
    ...(options.version ? { version: options.version } : {}),
    checks,
  };
}

function mapReasonFromCheck(
  check: ProviderHealthCheck,
): ProviderHealthReason | null {
  if (check.name === "binary") return "not-installed";
  if (check.name === "auth") return "unauthenticated";
  if (check.name === "transport" || check.name === "runtime") {
    return "transport";
  }
  if (check.name === "version") return "process";
  return "unknown";
}

function runBinaryCommand(
  binaryPath: string,
  args: string[],
  env?: Record<string, string | undefined>,
): {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
} {
  const result = spawnSync(binaryPath, args, {
    encoding: "utf-8",
    timeout: CLI_TIMEOUT_MS,
    env,
    ...(process.platform === "win32" ? { shell: true } : {}),
  });

  const stdout = `${result.stdout ?? ""}`.trim();
  const stderr = `${result.stderr ?? ""}`.trim();
  if (result.error) {
    return {
      ok: false,
      stdout,
      stderr,
      error: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      stdout,
      stderr,
      error:
        stderr ||
        stdout ||
        `${binaryPath} ${args.join(" ")} exited with code ${result.status ?? "unknown"}`,
    };
  }

  return { ok: true, stdout, stderr };
}

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

function buildClaudeVersionCheck(
  binaryPath: string,
): ProviderHealthCheck {
  const result = runBinaryCommand(binaryPath, ["--version"], buildClaudeAgentEnv());
  if (!result.ok) {
    return createCheck("version", "warn", {
      message: result.error ?? "Unable to read Claude Code version",
    });
  }

  return createCheck("version", "pass", {
    observedValue: result.stdout,
  });
}

function buildCodexVersionCheck(
  binaryPath: string,
): ProviderHealthCheck {
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

function classifyAuthCheck(message: string): ProviderHealthCheck {
  if (/login|auth|unauthorized|forbidden|not logged in/i.test(message)) {
    return createCheck("auth", "fail", { message });
  }
  return createCheck("auth", "unknown", { message });
}

export async function getClaudeProviderSnapshot(): Promise<ProviderProbeResult> {
  const binaryPath = resolveClaudeCli();
  if (!binaryPath) {
    return {
      health: buildHealthState("claude", [
        createCheck("binary", "fail", {
          message: "Claude Code CLI not found",
        }),
        createCheck("version", "unknown"),
        createCheck("auth", "unknown"),
        createCheck("runtime", "unknown"),
      ]),
      models: [],
    };
  }

  const versionCheck = buildClaudeVersionCheck(binaryPath);
  const debugFile = getClaudeAgentDebugFilePath();

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const q = query({
      prompt: "",
      options: {
        maxTurns: 1,
        tools: [],
        permissionMode: "plan",
        persistSession: false,
        env: buildClaudeAgentEnv(),
        ...(debugFile ? { debugFile } : {}),
        pathToClaudeCodeExecutable: binaryPath,
      },
    });

    try {
      const rawModels = await q.supportedModels();
      const models = rawModels.map((model) => ({
        value: model.value,
        displayName: model.displayName,
        description: model.description,
      }));
      return {
        health: buildHealthState(
          "claude",
          [
            createCheck("binary", "pass", { observedValue: binaryPath }),
            versionCheck,
            createCheck("auth", "pass"),
            createCheck("runtime", "pass"),
            createCheck("models", models.length > 0 ? "pass" : "warn", {
              message:
                models.length > 0
                  ? undefined
                  : "Claude model discovery returned no visible models",
            }),
          ],
          {
            binaryPath,
            version:
              versionCheck.status === "pass"
                ? versionCheck.observedValue
                : undefined,
          },
        ),
        models,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to query Claude Code";
      if (/closed before|closed early|query closed/i.test(message)) {
        return {
          health: buildHealthState(
            "claude",
            [
              createCheck("binary", "pass", { observedValue: binaryPath }),
              versionCheck,
              createCheck("auth", "pass"),
              createCheck("runtime", "warn", { message }),
              createCheck("models", "warn", {
                message: "Using fallback Claude model catalog",
              }),
            ],
            {
              binaryPath,
              version:
                versionCheck.status === "pass"
                  ? versionCheck.observedValue
                  : undefined,
              message,
            },
          ),
          models: FALLBACK_CLAUDE_MODELS,
        };
      }

      return {
        health: buildHealthState(
          "claude",
          [
            createCheck("binary", "pass", { observedValue: binaryPath }),
            versionCheck,
            classifyAuthCheck(message),
            createCheck("runtime", "warn", { message }),
            createCheck("models", "unknown"),
          ],
          {
            binaryPath,
            version:
              versionCheck.status === "pass"
                ? versionCheck.observedValue
                : undefined,
            message,
          },
        ),
        models: [],
      };
    } finally {
      q.close();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Claude SDK";
    return {
      health: buildHealthState(
        "claude",
        [
          createCheck("binary", "pass", { observedValue: binaryPath }),
          versionCheck,
          classifyAuthCheck(message),
          createCheck("runtime", "warn", { message }),
          createCheck("models", "unknown"),
        ],
        {
          binaryPath,
          version:
            versionCheck.status === "pass"
              ? versionCheck.observedValue
              : undefined,
          message,
        },
      ),
      models: [],
    };
  }
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
        createCheck(runtime.ok ? "runtime" : "transport", runtime.ok ? "pass" : "warn", {
          ...(runtime.message ? { message: runtime.message } : {}),
        }),
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
