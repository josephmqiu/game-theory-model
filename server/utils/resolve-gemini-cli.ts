import { resolveCliPath } from "./resolve-cli-path";

export function resolveGeminiCli(): string | undefined {
  return resolveCliPath("gemini");
}
