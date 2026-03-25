import type { ProviderHealthCheck } from "../../../shared/types/analysis-runtime";
import { resolveClaudeCli } from "../../utils/resolve-claude-cli";
import {
  buildClaudeAgentEnv,
  getClaudeAgentDebugFilePath,
} from "../../utils/resolve-claude-agent-env";
import {
  buildHealthState,
  classifyAuthCheck,
  createCheck,
  runBinaryCommand,
  type ProviderCatalogModel,
  type ProviderProbeResult,
} from "./provider-health";

const FALLBACK_CLAUDE_MODELS: ProviderCatalogModel[] = [
  {
    value: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    description: "",
  },
  {
    value: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    description: "",
  },
  {
    value: "claude-sonnet-4-5-20250514",
    displayName: "Claude Sonnet 4.5",
    description: "",
  },
  {
    value: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    description: "",
  },
  {
    value: "claude-3-7-sonnet-20250219",
    displayName: "Claude 3.7 Sonnet",
    description: "",
  },
  {
    value: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    description: "",
  },
  {
    value: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    description: "",
  },
];

function buildClaudeVersionCheck(binaryPath: string): ProviderHealthCheck {
  const result = runBinaryCommand(
    binaryPath,
    ["--version"],
    buildClaudeAgentEnv(),
  );
  if (!result.ok) {
    return createCheck("version", "warn", {
      message: result.error ?? "Unable to read Claude Code version",
    });
  }

  return createCheck("version", "pass", {
    observedValue: result.stdout,
  });
}

export async function getClaudeProviderSnapshot(): Promise<ProviderProbeResult> {
  const binaryPath = resolveClaudeCli();
  if (!binaryPath) {
    return {
      health: buildHealthState("claude", [
        createCheck("binary", "fail", {
          message: "Claude Code CLI not found",
        }),
        createCheck("version", "unknown"),
        createCheck("auth", "unknown"),
        createCheck("runtime", "unknown"),
      ]),
      models: [],
    };
  }

  const versionCheck = buildClaudeVersionCheck(binaryPath);
  const debugFile = getClaudeAgentDebugFilePath();

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const q = query({
      prompt: "",
      options: {
        maxTurns: 1,
        tools: [],
        permissionMode: "plan",
        persistSession: false,
        env: buildClaudeAgentEnv(),
        ...(debugFile ? { debugFile } : {}),
        pathToClaudeCodeExecutable: binaryPath,
      },
    });

    try {
      const rawModels = await q.supportedModels();
      const models = rawModels.map((model) => ({
        value: model.value,
        displayName: model.displayName,
        description: model.description,
      }));
      return {
        health: buildHealthState(
          "claude",
          [
            createCheck("binary", "pass", { observedValue: binaryPath }),
            versionCheck,
            createCheck("auth", "pass"),
            createCheck("runtime", "pass"),
            createCheck("models", models.length > 0 ? "pass" : "warn", {
              message:
                models.length > 0
                  ? undefined
                  : "Claude model discovery returned no visible models",
            }),
          ],
          {
            binaryPath,
            version:
              versionCheck.status === "pass"
                ? versionCheck.observedValue
                : undefined,
          },
        ),
        models,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to query Claude Code";
      if (/closed before|closed early|query closed/i.test(message)) {
        return {
          health: buildHealthState(
            "claude",
            [
              createCheck("binary", "pass", { observedValue: binaryPath }),
              versionCheck,
              createCheck("auth", "pass"),
              createCheck("runtime", "warn", { message }),
              createCheck("models", "warn", {
                message: "Using fallback Claude model catalog",
              }),
            ],
            {
              binaryPath,
              version:
                versionCheck.status === "pass"
                  ? versionCheck.observedValue
                  : undefined,
              message,
            },
          ),
          models: FALLBACK_CLAUDE_MODELS,
        };
      }

      return {
        health: buildHealthState(
          "claude",
          [
            createCheck("binary", "pass", { observedValue: binaryPath }),
            versionCheck,
            classifyAuthCheck(message),
            createCheck("runtime", "warn", { message }),
            createCheck("models", "unknown"),
          ],
          {
            binaryPath,
            version:
              versionCheck.status === "pass"
                ? versionCheck.observedValue
                : undefined,
            message,
          },
        ),
        models: [],
      };
    } finally {
      q.close();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Claude SDK";
    return {
      health: buildHealthState(
        "claude",
        [
          createCheck("binary", "pass", { observedValue: binaryPath }),
          versionCheck,
          classifyAuthCheck(message),
          createCheck("runtime", "warn", { message }),
          createCheck("models", "unknown"),
        ],
        {
          binaryPath,
          version:
            versionCheck.status === "pass"
              ? versionCheck.observedValue
              : undefined,
          message,
        },
      ),
      models: [],
    };
  }
}
