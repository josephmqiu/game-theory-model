import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/ui-store";
import { aiStore, useAiStore } from "@/stores/ai-store";
import {
  agentSettingsStore,
  hydrateAgentSettingsStore,
  useAgentSettingsStore,
} from "@/stores/agent-settings-store";
import type {
  AIProviderType,
  GroupedModel,
  IntegrationStatusSnapshot,
  MCPCliTool,
  MCPTransportMode,
  ProviderStatusSnapshot,
  ProviderConnectionMethod,
} from "@/types/agent-settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const CONNECTOR_ORDER: AIProviderType[] = [
  "anthropic",
  "openai",
  "opencode",
  "copilot",
];

const PROVIDER_CONNECTION_METHOD: Record<AIProviderType, ProviderConnectionMethod> = {
  anthropic: "claude-code",
  openai: "codex-cli",
  opencode: "opencode",
  copilot: "copilot",
};

const PROVIDER_SETUP_HINTS: Record<
  AIProviderType,
  { install: string; authenticate: string }
> = {
  anthropic: {
    install: "Install the Claude Code CLI, then return here to validate and connect it.",
    authenticate:
      'Run "claude login" or configure your Anthropic credentials before validating.',
  },
  openai: {
    install: "Install the Codex CLI, then run it once so the local model cache exists.",
    authenticate:
      "Authenticate Codex/OpenAI in your terminal before validating model discovery.",
  },
  opencode: {
    install: "Install OpenCode and start its local service before validating here.",
    authenticate:
      "Configure providers inside OpenCode first so model discovery has something to return.",
  },
  copilot: {
    install: "Install the GitHub Copilot CLI on this machine before connecting it here.",
    authenticate: 'Run "copilot login" in your terminal before validating.',
  },
};

const MCP_SETUP_HINTS: Record<MCPCliTool, string> = {
  "claude-code":
    "Detect the CLI, validate it here, then write a managed MCP config for external tooling.",
  "codex-cli":
    "Detect Codex CLI, validate it, then write a managed MCP config before enabling it.",
  "gemini-cli":
    "Install Gemini CLI locally, validate it, then write a managed MCP config.",
  "opencode-cli":
    "Start OpenCode locally, validate it here, then write a managed MCP config.",
  "kiro-cli":
    "Install Kiro CLI locally, validate it, then write a managed MCP config.",
  "copilot-cli":
    "Authenticate Copilot CLI first, then validate it and write a managed MCP config.",
};

export function SettingsPage() {
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const aiPanelMinimized = useUiStore((s) => s.aiPanelMinimized);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const manualMode = useUiStore((s) => s.manualMode);
  const setAiPanelOpen = useUiStore((s) => s.setAiPanelOpen);
  const toggleInspector = useUiStore((s) => s.toggleInspector);
  const setManualMode = useUiStore((s) => s.setManualMode);
  const provider = useAiStore((s) => s.provider);
  const providers = useAgentSettingsStore((s) => s.providers);
  const connectingProvider = useAgentSettingsStore((s) => s.connectingProvider);
  const connectionErrors = useAgentSettingsStore((s) => s.connectionErrors);
  const mcpIntegrations = useAgentSettingsStore((s) => s.mcpIntegrations);
  const mcpTransportMode = useAgentSettingsStore((s) => s.mcpTransportMode);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void hydrateAgentSettingsStore();
    void refreshStatuses();
  }, []);

  async function refreshStatuses(): Promise<void> {
    try {
      const response = await fetch("/api/integrations/status");
      const result = (await response.json()) as {
        providers: ProviderStatusSnapshot[];
        integrations: IntegrationStatusSnapshot[];
      };

      agentSettingsStore.getState().syncProviderStatuses(result.providers);
      agentSettingsStore.getState().syncIntegrationStatuses(result.integrations);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not refresh integration status.",
      );
    }
  }

  async function handleConnect(providerType: AIProviderType): Promise<void> {
    setActionError(null);
    setBusyAction(`connect:${providerType}`);
    agentSettingsStore.getState().setConnectingProvider(providerType);
    agentSettingsStore.getState().setConnectionError(providerType, null);

    try {
      const response = await fetch("/api/ai/connect-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: PROVIDER_CONNECTION_METHOD[providerType],
        }),
      });

      const result = (await response.json()) as {
        connected: boolean;
        models: GroupedModel[];
        error?: string;
        notInstalled?: boolean;
      };

      if (!response.ok || !result.connected) {
        const message = result.error ?? `Failed to connect ${providerType}`;
        agentSettingsStore.getState().setConnectionError(providerType, message);
        agentSettingsStore.getState().syncProviderStatuses([
          {
            provider: providerType,
            installed: !result.notInstalled,
            authenticated: null,
            validated: false,
            statusMessage: message,
            lastCheckedAt: new Date().toISOString(),
            configPath: null,
          },
        ]);
        return;
      }

      agentSettingsStore
        .getState()
        .connectProvider(
          providerType,
          PROVIDER_CONNECTION_METHOD[providerType],
          result.models,
        );

      const firstModel = result.models[0];
      if (firstModel) {
        aiStore.getState().setProvider({
          provider: providerType,
          modelId: firstModel.value,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to connect ${providerType}`;
      agentSettingsStore.getState().setConnectionError(providerType, message);
      setActionError(message);
    } finally {
      setBusyAction(null);
      agentSettingsStore.getState().setConnectingProvider(null);
    }
  }

  function handleDisconnect(providerType: AIProviderType): void {
    agentSettingsStore.getState().disconnectProvider(providerType);
  }

  async function handleValidateProvider(providerType: AIProviderType): Promise<void> {
    setActionError(null);
    setBusyAction(`validate-provider:${providerType}`);
    try {
      const response = await fetch("/api/integrations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "provider",
          target: providerType,
        }),
      });
      const result = (await response.json()) as {
        provider?: ProviderStatusSnapshot;
        models?: GroupedModel[];
        error?: string;
      };

      if (!response.ok || !result.provider) {
        throw new Error(result.error ?? `Could not validate ${providerType}`);
      }

      agentSettingsStore.getState().syncProviderStatuses([result.provider]);
      if (result.models?.length) {
        agentSettingsStore
          .getState()
          .connectProvider(
            providerType,
            PROVIDER_CONNECTION_METHOD[providerType],
            result.models,
          );
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Could not validate ${providerType}`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleToggleIntegration(tool: MCPCliTool): void {
    agentSettingsStore.getState().toggleMcpIntegration(tool);
  }

  async function handleValidateIntegration(tool: MCPCliTool): Promise<void> {
    setActionError(null);
    setBusyAction(`validate-integration:${tool}`);
    try {
      const response = await fetch("/api/integrations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "integration",
          target: tool,
        }),
      });
      const result = (await response.json()) as {
        integration?: IntegrationStatusSnapshot;
        error?: string;
      };

      if (!response.ok || !result.integration) {
        throw new Error(result.error ?? `Could not validate ${tool}`);
      }

      agentSettingsStore.getState().syncIntegrationStatuses([result.integration]);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Could not validate ${tool}`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleWriteConfig(tool: MCPCliTool): Promise<void> {
    setActionError(null);
    setBusyAction(`write-config:${tool}`);
    try {
      const response = await fetch("/api/mcp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool,
          transportMode: mcpTransportMode,
        }),
      });
      const result = (await response.json()) as {
        integration?: IntegrationStatusSnapshot;
        error?: string;
      };

      if (!response.ok || !result.integration) {
        throw new Error(result.error ?? `Could not write MCP config for ${tool}`);
      }

      agentSettingsStore.getState().syncIntegrationStatuses([result.integration]);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Could not write MCP config for ${tool}`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemoveConfig(tool: MCPCliTool): Promise<void> {
    setActionError(null);
    setBusyAction(`remove-config:${tool}`);
    try {
      const response = await fetch("/api/mcp/config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool }),
      });
      const result = (await response.json()) as {
        integration?: IntegrationStatusSnapshot | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? `Could not remove MCP config for ${tool}`);
      }

      if (result.integration) {
        agentSettingsStore.getState().syncIntegrationStatuses([result.integration]);
      } else {
        await refreshStatuses();
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Could not remove MCP config for ${tool}`,
      );
    } finally {
      setBusyAction(null);
    }
  }

  function handleTransportMode(mode: MCPTransportMode): void {
    agentSettingsStore.getState().setMcpTransportMode(mode);
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Shell Preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Persisted layout and workflow defaults for the root app shell.
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <SettingRow label="AI panel" value={aiPanelOpen ? "Open" : "Closed"} />
            <SettingRow
              label="AI panel mode"
              value={aiPanelMinimized ? "Minimized" : "Expanded"}
            />
            <SettingRow
              label="Inspector"
              value={inspectorOpen ? "Visible" : "Hidden"}
            />
            <SettingRow
              label="Manual modeling"
              value={manualMode ? "Enabled" : "Disabled"}
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {aiPanelOpen ? "Close AI panel" : "Open AI panel"}
            </button>
            <button
              type="button"
              onClick={toggleInspector}
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {inspectorOpen ? "Hide inspector" : "Show inspector"}
            </button>
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              {manualMode ? "Disable manual mode" : "Enable manual mode"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Connector Platform</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct provider connections and local tool discovery lifted into the
            root app from the OpenPencil connector approach.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void refreshStatuses()}
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              Refresh status
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {CONNECTOR_ORDER.map((providerType) => {
              const config = providers[providerType];
              const isConnecting = connectingProvider === providerType;
              const error = connectionErrors[providerType];
              const isValidating = busyAction === `validate-provider:${providerType}`;

              return (
                <div
                  key={providerType}
                  className="rounded-lg border border-border/70 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {config.displayName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {config.isConnected
                          ? `${config.models.length} models discovered via ${config.connectionMethod}`
                          : `Connect via ${PROVIDER_CONNECTION_METHOD[providerType]}`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <StatusBadge
                          tone={config.installed ? "ready" : "missing"}
                          label={config.installed ? "Installed" : "Missing"}
                        />
                        <StatusBadge
                          tone={config.validated ? "ready" : "pending"}
                          label={config.validated ? "Validated" : "Not validated"}
                        />
                        <StatusBadge
                          tone={
                            config.authenticated === false
                              ? "missing"
                              : config.authenticated
                                ? "ready"
                                : "pending"
                          }
                          label={
                            config.authenticated === false
                              ? "Auth needed"
                              : config.authenticated
                                ? "Authenticated"
                                : "Auth unknown"
                          }
                        />
                      </div>
                      {config.statusMessage && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {config.statusMessage}
                        </p>
                      )}
                      {!config.installed && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {PROVIDER_SETUP_HINTS[providerType].install}
                        </p>
                      )}
                      {config.installed && config.authenticated !== true && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {PROVIDER_SETUP_HINTS[providerType].authenticate}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void handleValidateProvider(providerType)}
                        disabled={isValidating}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                      >
                        {isValidating ? "Validating..." : "Validate"}
                      </button>
                      {config.isConnected ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(providerType)}
                          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConnect(providerType)}
                          disabled={isConnecting || !config.installed}
                          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>

                  {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                  {config.models.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {config.models.map((model) => (
                        <div
                          key={model.value}
                          className="rounded-md border border-border bg-card px-3 py-2"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {model.displayName}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {model.value}
                          </p>
                          {model.description && (
                            <p className="mt-1 text-xs text-muted-foreground">
                            {model.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">MCP Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Local CLI integrations, install state, and MCP readiness for the
            external tool surface.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["stdio", "http", "both"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleTransportMode(mode)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  mcpTransportMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground hover:bg-accent"
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mcpIntegrations.map((integration) => {
              const isValidating = busyAction === `validate-integration:${integration.tool}`;
              const isWritingConfig = busyAction === `write-config:${integration.tool}`;
              const isRemovingConfig = busyAction === `remove-config:${integration.tool}`;

              return (
                <div
                  key={integration.tool}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    integration.enabled
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {integration.displayName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <StatusBadge
                          tone={integration.installed ? "ready" : "missing"}
                          label={integration.installed ? "Installed" : "Missing"}
                        />
                        <StatusBadge
                          tone={integration.validated ? "ready" : "pending"}
                          label={integration.validated ? "Validated" : "Not validated"}
                        />
                        <StatusBadge
                          tone={integration.configPath ? "ready" : "pending"}
                          label={integration.configPath ? "Config written" : "No config"}
                        />
                        <StatusBadge
                          tone={integration.enabled ? "ready" : "pending"}
                          label={integration.enabled ? "Enabled" : "Disabled"}
                        />
                      </div>
                      {integration.statusMessage && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {integration.statusMessage}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {MCP_SETUP_HINTS[integration.tool]}
                      </p>
                      <p className="mt-2 break-all text-xs text-muted-foreground">
                        Managed config: {integration.configPath ?? "Not written yet"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void handleValidateIntegration(integration.tool)}
                        disabled={isValidating}
                        className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isValidating ? "Validating..." : "Validate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleWriteConfig(integration.tool)}
                        disabled={!integration.installed || isWritingConfig}
                        className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isWritingConfig ? "Writing..." : "Write config"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveConfig(integration.tool)}
                        disabled={!integration.configPath || isRemovingConfig}
                        className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRemovingConfig ? "Removing..." : "Remove config"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleIntegration(integration.tool)}
                        disabled={
                          !integration.installed ||
                          !integration.validated ||
                          !integration.configPath
                        }
                        className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {integration.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Current Chat Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The floating chat panel now routes provider and model selection
            through the connector platform state.
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <SettingRow label="Provider" value={provider.provider} />
            <SettingRow label="Model" value={provider.modelId} />
          </dl>

          {actionError && <p className="mt-4 text-sm text-red-500">{actionError}</p>}
        </section>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ready" | "pending" | "missing";
}) {
  const classes =
    tone === "ready"
      ? "bg-green-500/10 text-green-600"
      : tone === "missing"
        ? "bg-red-500/10 text-red-600"
        : "bg-secondary text-muted-foreground";

  return <span className={`rounded-full px-2 py-0.5 ${classes}`}>{label}</span>;
}
