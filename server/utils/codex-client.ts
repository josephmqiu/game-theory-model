/**
 * Allowlist-based env filter for Codex CLI subprocess.
 * Only passes through safe system vars and provider-specific prefixes.
 * Prevents leaking secrets like ANTHROPIC_API_KEY, AWS_SECRET_KEY, GITHUB_TOKEN, etc.
 */
const CODEX_ENV_ALLOWLIST = new Set([
  "PATH",
  "HOME",
  "TERM",
  "LANG",
  "SHELL",
  "TMPDIR",
  // Windows-essential vars
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

export function filterCodexEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    if (
      CODEX_ENV_ALLOWLIST.has(k) ||
      k.startsWith("OPENAI_") ||
      k.startsWith("CODEX_")
    ) {
      result[k] = v;
    }
  }
  return result;
}
