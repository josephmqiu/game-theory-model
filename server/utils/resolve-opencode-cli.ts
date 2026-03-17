import { resolveCliPath } from "./resolve-cli-path";

export function resolveOpenCodeCli(): string | undefined {
  return resolveCliPath("opencode");
}
