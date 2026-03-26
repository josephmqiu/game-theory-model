/**
 * Nitro plugin — runs fire-and-forget health probes for Claude and Codex
 * providers on server startup. Results are logged but do not block startup.
 */

import { getClaudeProviderSnapshot } from "../services/ai/claude-health";
import { getCodexProviderSnapshot } from "../services/ai/codex-health";

export default () => {
  if (process.env.VITEST === "true") return;
  void Promise.allSettled([
    getClaudeProviderSnapshot(),
    getCodexProviderSnapshot(),
  ]).then(([claude, codex]) => {
    const summarize = (name: string, r: PromiseSettledResult<unknown>) => {
      if (r.status === "rejected") {
        return `${name}: probe failed (${r.reason})`;
      }
      const s = r.value as { overallStatus?: string; models?: unknown[] };
      return `${name}: ${s.overallStatus ?? "unknown"} (${s.models?.length ?? 0} models)`;
    };
    console.log(
      `[health] startup probe: ${summarize("claude", claude)}, ${summarize("codex", codex)}`,
    );
  });
};
