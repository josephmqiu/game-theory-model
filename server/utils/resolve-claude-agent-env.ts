import { mkdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

type EnvLike = Record<string, string | undefined>;

interface ClaudeSettings {
  env?: Record<string, unknown>;
}

function normalizeEnvValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    if (key === "ANTHROPIC_CUSTOM_HEADERS") {
      try {
        return JSON.stringify(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  return undefined;
}

function readSingleSettingsFile(filePath: string): EnvLike {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ClaudeSettings;
    if (!parsed.env || typeof parsed.env !== "object") return {};

    const env: EnvLike = {};
    for (const [key, value] of Object.entries(parsed.env)) {
      const normalized = normalizeEnvValue(key, value);
      if (normalized !== undefined) {
        env[key] = normalized;
      }
    }
    return env;
  } catch {
    return {};
  }
}

function readClaudeSettingsEnv(): EnvLike {
  const claudeDir = join(homedir(), ".claude");
  const base = readSingleSettingsFile(join(claudeDir, "settings.json"));
  const local = readSingleSettingsFile(join(claudeDir, "settings.local.json"));
  return { ...base, ...local };
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function buildClaudeAgentEnv(): EnvLike {
  const merged: EnvLike = {
    ...readClaudeSettingsEnv(),
    ...(process.env as EnvLike),
  };

  if (
    merged.ANTHROPIC_CUSTOM_HEADERS &&
    !isValidJson(merged.ANTHROPIC_CUSTOM_HEADERS)
  ) {
    delete merged.ANTHROPIC_CUSTOM_HEADERS;
  }

  if (merged.ANTHROPIC_AUTH_TOKEN && !merged.ANTHROPIC_API_KEY) {
    merged.ANTHROPIC_API_KEY = merged.ANTHROPIC_AUTH_TOKEN;
  }

  delete merged.CLAUDECODE;

  return merged;
}

export function getClaudeAgentDebugFilePath(): string | undefined {
  try {
    const directory = join(tmpdir(), "game-theory-claude-debug");
    mkdirSync(directory, { recursive: true });
    return join(directory, "claude-agent.log");
  } catch {
    return undefined;
  }
}
