import { execSync } from "node:child_process";

const isWindows = process.platform === "win32";

export function resolveCliPath(command: string): string | undefined {
  try {
    const lookup = isWindows
      ? `where ${command} 2>nul`
      : `which ${command} 2>/dev/null`;
    const result = execSync(lookup, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    return result.split(/\r?\n/)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
