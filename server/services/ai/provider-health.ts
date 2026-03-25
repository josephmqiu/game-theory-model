import { spawnSync } from "node:child_process";
import type {
  ProviderHealthCheck,
  ProviderHealthReason,
  ProviderHealthState,
  RuntimeProvider,
} from "../../../shared/types/analysis-runtime";

export interface ProviderCatalogModel {
  value: string;
  displayName: string;
  description: string;
}

export interface ProviderProbeResult {
  health: ProviderHealthState;
  models: ProviderCatalogModel[];
}

export const CLI_TIMEOUT_MS = 5_000;

export function createCheck(
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

export function buildHealthState(
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

export function runBinaryCommand(
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

export function classifyAuthCheck(message: string): ProviderHealthCheck {
  if (/login|auth|unauthorized|forbidden|not logged in/i.test(message)) {
    return createCheck("auth", "fail", { message });
  }
  return createCheck("auth", "unknown", { message });
}
