import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import { execSync } from "node:child_process";

interface InstallBody {
  agent: "claude-code" | "codex-cli";
}

interface InstallResult {
  success: boolean;
  error?: string;
  command?: string;
  docsUrl?: string;
}

const BINARY_MAP: Record<string, string> = {
  "claude-code": "claude",
  "codex-cli": "codex",
};

function checkBinary(binary: string): boolean {
  try {
    const cmd =
      process.platform === "win32"
        ? `where ${binary} 2>nul`
        : `which ${binary} 2>/dev/null`;
    return !!execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return false;
  }
}

function hasCommand(cmd: string): boolean {
  return checkBinary(cmd);
}

function getInstallInfo(agent: string): { command: string; docsUrl: string } {
  switch (agent) {
    case "claude-code":
      return {
        command: "npm install -g @anthropic-ai/claude-code",
        docsUrl: "https://docs.anthropic.com/en/docs/claude-code",
      };
    case "codex-cli":
      return {
        command: "npm install -g @openai/codex",
        docsUrl: "https://github.com/openai/codex",
      };
    default:
      return { command: "", docsUrl: "" };
  }
}

/**
 * POST /api/ai/install-agent
 * Attempts to auto-install a CLI agent. Returns manual instructions on failure.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<InstallBody>(event);
  setResponseHeaders(event, { "Content-Type": "application/json" });

  if (!body?.agent) {
    return {
      success: false,
      error: "Missing agent field",
    } satisfies InstallResult;
  }

  const binary = BINARY_MAP[body.agent];
  if (!binary) {
    return {
      success: false,
      error: `Unknown agent: ${body.agent}`,
    } satisfies InstallResult;
  }

  // Already installed
  if (checkBinary(binary)) {
    return { success: true } satisfies InstallResult;
  }

  const info = getInstallInfo(body.agent);

  // Try auto-install
  const result = await tryAutoInstall(body.agent, binary);
  if (result.success) return result;

  // Return failure with manual instructions
  return {
    success: false,
    error: result.error || "Auto-install failed",
    command: info.command,
    docsUrl: info.docsUrl,
  } satisfies InstallResult;
});

async function tryAutoInstall(
  agent: string,
  binary: string,
): Promise<InstallResult> {
  switch (agent) {
    case "claude-code":
      return tryNpmInstall("@anthropic-ai/claude-code", binary);
    case "codex-cli":
      return tryNpmInstall("@openai/codex", binary);
    default:
      return { success: false, error: "Unknown agent" };
  }
}

async function tryNpmInstall(
  pkg: string,
  binary: string,
): Promise<InstallResult> {
  if (!hasCommand("npm")) {
    return { success: false, error: "npm not found. Install Node.js first." };
  }

  try {
    execSync(`npm install -g ${pkg}`, {
      encoding: "utf-8",
      timeout: 180_000,
      stdio: "pipe",
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr || "";
    const msg = stderr.includes("EACCES")
      ? "Permission denied. Try running with sudo or fix npm permissions."
      : err instanceof Error
        ? err.message
        : "npm install failed";
    return { success: false, error: msg };
  }

  return checkBinary(binary)
    ? { success: true }
    : {
        success: false,
        error: "Install completed but binary not found in PATH",
      };
}
