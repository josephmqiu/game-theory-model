import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const isWindows = platform() === "win32";

export function resolveClaudeCli(): string | undefined {
  try {
    const command = isWindows ? "where claude" : "which claude 2>/dev/null";
    const result = execSync(command, {
      encoding: "utf-8",
      timeout: 3000,
    })
      .trim()
      .split(/\r?\n/)[0];

    if (result && existsSync(result)) return result;
  } catch {
    // Ignore PATH lookup failures.
  }

  const candidates = isWindows
    ? [
        join(
          process.env.LOCALAPPDATA || "",
          "Programs",
          "claude-code",
          "claude.exe",
        ),
        join(
          process.env.LOCALAPPDATA || "",
          "Microsoft",
          "WinGet",
          "Links",
          "claude.exe",
        ),
        join(homedir(), ".claude", "local", "claude.exe"),
        join(
          homedir(),
          "AppData",
          "Local",
          "Programs",
          "claude-code",
          "claude.exe",
        ),
      ]
    : [
        join(homedir(), ".local", "bin", "claude"),
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude",
      ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return undefined;
}
