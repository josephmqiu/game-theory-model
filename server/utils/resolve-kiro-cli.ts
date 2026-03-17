import { resolveCliPath } from "./resolve-cli-path";

export function resolveKiroCli(): string | undefined {
  return resolveCliPath("kiro");
}
