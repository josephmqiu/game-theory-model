import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ThinkingMode = "adaptive" | "disabled" | "enabled";
type ThinkingEffort = "low" | "medium" | "high" | "max";

interface CodexExecOptions {
  model?: string;
  systemPrompt?: string;
  thinkingMode?: ThinkingMode;
  thinkingBudgetTokens?: number;
  effort?: ThinkingEffort;
  timeoutMs?: number;
}

interface CodexCliResult {
  text?: string;
  error?: string;
}

const DEFAULT_CODEX_TIMEOUT_MS = 15 * 60 * 1000;
const CODEX_ENV_ALLOWLIST = new Set([
  "PATH",
  "HOME",
  "TERM",
  "LANG",
  "SHELL",
  "TMPDIR",
  "SYSTEMROOT",
  "COMSPEC",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PATHEXT",
  "SYSTEMDRIVE",
  "TEMP",
  "TMP",
  "HOMEDRIVE",
  "HOMEPATH",
]);

function filterCodexEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (
      CODEX_ENV_ALLOWLIST.has(key) ||
      key.startsWith("OPENAI_") ||
      key.startsWith("CODEX_")
    ) {
      result[key] = value;
    }
  }
  return result;
}

function buildPrompt(
  systemPrompt: string | undefined,
  userPrompt: string,
): string {
  if (!systemPrompt?.trim()) return userPrompt.trim();
  return [
    "SYSTEM INSTRUCTIONS:",
    systemPrompt.trim(),
    "",
    "USER REQUEST:",
    userPrompt.trim(),
  ].join("\n");
}

function resolveCodexEffort(
  thinkingMode: ThinkingMode | undefined,
  effort: ThinkingEffort | undefined,
): "low" | "medium" | "high" | undefined {
  if (thinkingMode === "disabled") return "low";
  if (effort === "max") return "high";
  if (effort === "low" || effort === "medium" || effort === "high") {
    return effort;
  }
  if (thinkingMode === "enabled") return "medium";
  return undefined;
}

function parseCodexJsonLine(
  line: string,
): { text?: string; error?: string } | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.type === "error") {
    return {
      error:
        typeof parsed.message === "string"
          ? parsed.message
          : "Codex returned an unknown error.",
    };
  }

  const text =
    typeof parsed.delta === "string"
      ? parsed.delta
      : typeof parsed.text === "string"
        ? parsed.text
        : typeof parsed.content === "string"
          ? parsed.content
          : null;

  return text ? { text } : null;
}

function extractCodexCliError(stderr: string): string | null {
  const trimmed = stderr.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function executeCodexCommand(
  args: string[],
  timeoutMs: number,
): Promise<{ text: string; errors: string[] }> {
  return await new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      env: filterCodexEnv(process.env as Record<string, string | undefined>),
      stdio: ["ignore", "pipe", "pipe"],
      ...(process.platform === "win32" && { shell: true }),
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let textAccumulator = "";
    const errors: string[] = [];

    const flushStdoutLine = (line: string) => {
      const event = parseCodexJsonLine(line);
      if (!event) return;
      if (event.text) textAccumulator += event.text;
      if (event.error) errors.push(event.error);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `Codex request timed out after ${Math.round(timeoutMs / 1000)}s.`,
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf-8");
      let index = stdoutBuffer.indexOf("\n");
      while (index >= 0) {
        const line = stdoutBuffer.slice(0, index).trim();
        stdoutBuffer = stdoutBuffer.slice(index + 1);
        if (line) flushStdoutLine(line);
        index = stdoutBuffer.indexOf("\n");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const tail = stdoutBuffer.trim();
      if (tail) flushStdoutLine(tail);

      if (code === 0) {
        resolve({ text: textAccumulator, errors });
        return;
      }

      reject(
        new Error(
          extractCodexCliError(stderrBuffer) ??
            errors[errors.length - 1] ??
            `Codex exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

export async function runCodexExec(
  userPrompt: string,
  options: CodexExecOptions = {},
): Promise<CodexCliResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "game-theory-codex-"));
  const outputPath = join(tempDir, "last-message.txt");
  const effort = resolveCodexEffort(options.thinkingMode, options.effort);
  const args = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-last-message",
    outputPath,
  ];

  if (options.model) args.push("--model", options.model);
  if (effort) args.push("--config", `model_reasoning_effort="${effort}"`);
  args.push(buildPrompt(options.systemPrompt, userPrompt));

  try {
    const runResult = await executeCodexCommand(
      args,
      options.timeoutMs ?? DEFAULT_CODEX_TIMEOUT_MS,
    );
    const finalText = await readFile(outputPath, "utf-8").catch(() => "");
    const normalizedText = finalText.trim() || runResult.text.trim();

    if (normalizedText) {
      return { text: normalizedText };
    }

    if (runResult.errors.length > 0) {
      return { error: runResult.errors.join("; ") };
    }

    return { error: "Codex returned no output." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Codex execution failed",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
