import { resolveCliPath } from "./resolve-cli-path";

export function resolveCodexCli(): string | undefined {
  return resolveCliPath("codex");
}
