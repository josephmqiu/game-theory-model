import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { aiStore } from "@/stores/ai-store";
import {
  agentSettingsStore,
  hydrateAgentSettingsStore,
  useAgentSettingsStore,
} from "@/stores/agent-settings-store";
import { refreshIntegrationStatuses } from "@/services/integration-status";
import type {
  AIProviderConfig,
  AIProviderType,
  GroupedModel,
  ProviderConnectionMethod,
} from "@/types/agent-settings";
import { SettingRow } from "./-settings-helpers";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const CONNECTOR_ORDER: AIProviderType[] = ["anthropic", "openai"];

const PROVIDER_CONNECTION_METHOD: Record<
  AIProviderType,
  ProviderConnectionMethod
> = {
  anthropic: "claude-code",
  openai: "codex-cli",
  opencode: "opencode",
  copilot: "copilot",
};

export function SettingsPage() {
  const manualMode = useUiStore((s) => s.manualMode);
  const setManualMode = useUiStore((s) => s.setManualMode);
  const providers = useAgentSettingsStore((s) => s.providers);
  const connectingProvider = useAgentSettingsStore((s) => s.connectingProvider);
  const connectionErrors = useAgentSettingsStore((s) => s.connectionErrors);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void hydrateAgentSettingsStore();
    void refreshStatuses();
  }, []);

  async function refreshStatuses(): Promise<void> {
    try {
      await refreshIntegrationStatuses();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not refresh integration status.",
      );
    }
  }

  async function handleConnect(providerType: AIProviderType): Promise<void> {
    setActionError(null);
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
        installed: boolean;
        connected: boolean;
        authenticated: boolean | null;
        reachable: boolean | null;
        statusStage: AIProviderConfig["statusStage"];
        models: GroupedModel[];
        modelsDiscovered: number;
        error?: string;
        notInstalled?: boolean;
      };

      if (!response.ok || !result.connected) {
        const message = result.error ?? `Failed to connect ${providerType}`;
        agentSettingsStore.getState().setConnectionError(providerType, message);
        agentSettingsStore.getState().syncProviderStatuses([
          {
            provider: providerType,
            installed: result.installed,
            authenticated: result.authenticated,
            validated: false,
            statusStage: result.statusStage,
            reachable: result.reachable,
            lastError: message,
            modelsDiscovered: result.modelsDiscovered,
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

      agentSettingsStore.getState().syncProviderStatuses([
        {
          provider: providerType,
          installed: result.installed,
          authenticated: result.authenticated,
          validated: true,
          statusStage: result.statusStage,
          reachable: result.reachable,
          lastError: null,
          modelsDiscovered: result.modelsDiscovered,
          statusMessage:
            result.modelsDiscovered > 0
              ? `${result.modelsDiscovered} models discovered.`
              : "Connected.",
          lastCheckedAt: new Date().toISOString(),
          configPath: null,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to connect ${providerType}`;
      agentSettingsStore.getState().setConnectionError(providerType, message);
      setActionError(message);
    } finally {
      agentSettingsStore.getState().setConnectingProvider(null);
    }
  }

  function handleDisconnect(providerType: AIProviderType): void {
    agentSettingsStore.getState().disconnectProvider(providerType);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-10 flex items-center border-b border-border px-4 shrink-0 app-region-drag">
        <Link
          to="/editor"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors app-region-no-drag electron-traffic-light-pad"
        >
          <ArrowLeft size={14} />
          Back to Editor
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 p-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Shell Preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Persisted layout and workflow defaults for the root app shell.
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <SettingRow
              label="Manual modeling"
              value={manualMode ? "Enabled" : "Disabled"}
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
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

          <div className="mt-4 space-y-1">
            {CONNECTOR_ORDER.map((providerType) => {
              const config = providers[providerType];
              const isConnecting = connectingProvider === providerType;
              const error = connectionErrors[providerType];

              return (
                <div key={providerType} className="group">
                  <div
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                      config.isConnected ? "bg-primary/5" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {config.displayName}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          via {PROVIDER_CONNECTION_METHOD[providerType]}
                        </span>
                      </div>
                      {config.isConnected ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-green-600">
                          ✓ {config.models.length} model
                          {config.models.length !== 1 ? "s" : ""}
                        </span>
                      ) : error ? (
                        <span className="mt-0.5 block text-xs text-red-500">
                          {error}
                        </span>
                      ) : !config.installed ? (
                        <span className="mt-0.5 block text-xs text-amber-500">
                          CLI not found
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Ready to connect
                        </span>
                      )}
                    </div>

                    {config.isConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnect(providerType)}
                        className="shrink-0 rounded-md px-2.5 py-1 text-xs text-muted-foreground opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleConnect(providerType)}
                        disabled={isConnecting || !config.installed}
                        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isConnecting ? "Connecting\u2026" : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {actionError && <p className="text-sm text-red-500">{actionError}</p>}
      </div>
    </div>
  );
}
