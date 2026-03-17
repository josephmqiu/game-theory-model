import { execSync } from "node:child_process";

const isWindows = process.platform === "win32";

export function resolveCopilotCli(): string | undefined {
  try {
    const command = isWindows ? "where copilot 2>nul" : "which copilot 2>/dev/null";
    const result = execSync(command, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return result.split(/\r?\n/)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
