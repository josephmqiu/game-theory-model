import { useState, useEffect, useCallback, useRef } from "react";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Check,
  Loader2,
  Unplug,
  AlertCircle,
  Zap,
  Terminal,
  Globe,
  Copy,
  RefreshCw,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import type {
  AIProviderType,
  MCPTransportMode,
  GroupedModel,
} from "@/types/agent-settings";
import {
  ALLOWED_PROVIDERS,
  PROVIDER_LABELS,
} from "@/services/ai/allowed-providers";
import { PHASE_LABELS, V3_PHASES } from "@/types/methodology";
import type { AnalysisEffortLevel } from "../../../shared/types/analysis-runtime";
import ClaudeLogo from "@/components/icons/claude-logo";
import OpenAILogo from "@/components/icons/openai-logo";
import OpenCodeLogo from "@/components/icons/opencode-logo";
import CopilotLogo from "@/components/icons/copilot-logo";

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type SettingsTab = "providers" | "analysis" | "system";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** MCP tools that correspond to allowed providers */
const ALLOWED_MCP_TOOLS = new Set(["claude-code", "codex-cli"]);

const PROVIDER_META: Record<
  AIProviderType,
  {
    label: string;
    descriptionKey: string;
    agent: "claude-code" | "codex-cli" | "opencode" | "copilot";
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  anthropic: {
    label: PROVIDER_LABELS.anthropic,
    descriptionKey: "agents.claudeModels",
    agent: "claude-code",
    Icon: ClaudeLogo,
  },
  openai: {
    label: PROVIDER_LABELS.openai,
    descriptionKey: "agents.openaiModels",
    agent: "codex-cli",
    Icon: OpenAILogo,
  },
  opencode: {
    label: "OpenCode",
    descriptionKey: "agents.opencodeDesc",
    agent: "opencode",
    Icon: OpenCodeLogo,
  },
  copilot: {
    label: "GitHub Copilot",
    descriptionKey: "agents.copilotDesc",
    agent: "copilot",
    Icon: CopilotLogo,
  },
};

const ANALYSIS_EFFORT_OPTIONS: AnalysisEffortLevel[] = [
  "low",
  "medium",
  "high",
];

const ANALYSIS_EFFORT_LABEL_KEYS: Record<AnalysisEffortLevel, string> = {
  low: "agents.analysisEffortQuick",
  medium: "agents.analysisEffortStandard",
  high: "agents.analysisEffortThorough",
  max: "agents.analysisEffortThorough",
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function connectAgent(
  agent: "claude-code" | "codex-cli" | "opencode" | "copilot",
): Promise<{
  connected: boolean;
  models: GroupedModel[];
  error?: string;
  notInstalled?: boolean;
}> {
  try {
    const res = await fetch("/api/ai/connect-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent }),
    });
    if (!res.ok)
      return {
        connected: false,
        models: [],
        error: `server_error_${res.status}`,
      };
    return await res.json();
  } catch {
    return { connected: false, models: [], error: "connection_failed" };
  }
}

async function installAgent(
  agent: "claude-code" | "codex-cli" | "opencode" | "copilot",
): Promise<{
  success: boolean;
  error?: string;
  command?: string;
  docsUrl?: string;
}> {
  try {
    const res = await fetch("/api/ai/install-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent }),
    });
    if (!res.ok) return { success: false, error: `Server error ${res.status}` };
    return await res.json();
  } catch {
    return { success: false, error: "Request failed" };
  }
}

async function callMcpInstall(
  tool: string,
  action: "install" | "uninstall",
  transportMode?: MCPTransportMode,
  httpPort?: number,
): Promise<{ success: boolean; error?: string; fallbackHttp?: boolean }> {
  const res = await fetch("/api/ai/mcp-install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, action, transportMode, httpPort }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// ProviderRow (unchanged)
// ---------------------------------------------------------------------------

function ProviderRow({ type }: { type: AIProviderType }) {
  const { t } = useTranslation();
  const provider = useAgentSettingsStore((s) => s.providers[type]);
  const connect = useAgentSettingsStore((s) => s.connectProvider);
  const disconnect = useAgentSettingsStore((s) => s.disconnectProvider);
  const persist = useAgentSettingsStore((s) => s.persist);

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installInfo, setInstallInfo] = useState<{
    command: string;
    docsUrl: string;
  } | null>(null);

  const meta = PROVIDER_META[type];

  const handleConnect = useCallback(
    async (providerType: AIProviderType = type) => {
      const agentName = PROVIDER_META[providerType].agent;
      setIsConnecting(true);
      setError(null);
      setNotInstalled(false);
      setInstallInfo(null);
      const result = await connectAgent(agentName);
      if (result.connected) {
        connect(providerType, agentName, result.models);
        persist();
      } else if (result.notInstalled) {
        setNotInstalled(true);
      } else {
        if (result.error?.startsWith("server_error_")) {
          const status = result.error.replace("server_error_", "");
          setError(t("agents.serverError", { status }));
        } else if (result.error && result.error !== "connection_failed") {
          setError(result.error);
        } else {
          setError(t("agents.connectionFailed"));
        }
      }
      setIsConnecting(false);
    },
    [type, connect, persist, t],
  );

  const handleInstall = useCallback(async () => {
    const agentName = PROVIDER_META[type].agent;
    setIsInstalling(true);
    setError(null);
    setInstallInfo(null);
    const result = await installAgent(agentName);
    if (result.success) {
      setIsInstalling(false);
      setNotInstalled(false);
      handleConnect(type);
    } else {
      setIsInstalling(false);
      setError(result.error || t("agents.installFailed"));
      if (result.command || result.docsUrl) {
        setInstallInfo({
          command: result.command || "",
          docsUrl: result.docsUrl || "",
        });
      }
    }
  }, [type, handleConnect, t]);

  const handleDisconnect = useCallback(
    (providerType: AIProviderType = type) => {
      disconnect(providerType);
      setError(null);
      setNotInstalled(false);
      setInstallInfo(null);
      persist();
    },
    [type, disconnect, persist],
  );

  const { Icon } = meta;

  const renderAction = () => {
    if (provider.isConnected) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDisconnect(type)}
          className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Unplug size={11} className="mr-1" />
          {t("common.disconnect")}
        </Button>
      );
    }
    if (isInstalling) {
      return (
        <Button size="sm" disabled className="h-7 px-3 text-[11px] shrink-0">
          <Loader2 size={11} className="animate-spin mr-1" />
          {t("agents.installing")}
        </Button>
      );
    }
    if (notInstalled && !installInfo) {
      return (
        <Button
          size="sm"
          onClick={handleInstall}
          className="h-7 px-3 text-[11px] shrink-0"
        >
          <Download size={11} className="mr-1" />
          {t("agents.install")}
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        onClick={() => handleConnect(type)}
        disabled={isConnecting}
        className="h-7 px-3 text-[11px] shrink-0"
      >
        {isConnecting ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          t("common.connect")
        )}
      </Button>
    );
  };

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors",
          provider.isConnected ? "bg-secondary/40" : "hover:bg-secondary/30",
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors",
            provider.isConnected
              ? "bg-foreground/10 text-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground leading-tight">
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight hidden sm:inline">
              {t(meta.descriptionKey)}
            </span>
          </div>
          {provider.isConnected && (
            <span className="text-[11px] text-green-500 leading-tight flex items-center gap-1 mt-0.5">
              <Check size={10} strokeWidth={2.5} />
              {t("agents.modelCount", { count: provider.models.length })}
            </span>
          )}
          {notInstalled && !isInstalling && !error && (
            <span className="text-[10px] text-amber-500 leading-tight mt-0.5 block">
              {t("agents.notInstalled")}
            </span>
          )}
          {error && (
            <span className="text-[10px] text-destructive leading-tight mt-0.5 block">
              {error}
            </span>
          )}
        </div>

        {renderAction()}
      </div>

      {installInfo && (
        <div className="mx-3 mt-1 mb-1 px-2.5 py-2 rounded-md bg-secondary/30 flex items-center gap-2">
          {installInfo.command && (
            <code className="text-[10px] text-foreground font-mono flex-1 truncate select-all">
              {installInfo.command}
            </code>
          )}
          {installInfo.docsUrl && (
            <a
              href={installInfo.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              {t("agents.viewDocs")}
              <ExternalLink size={9} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panes
// ---------------------------------------------------------------------------

function ProvidersTab() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 px-1">
        <Zap size={12} className="text-muted-foreground" />
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {t("agents.agentsOnCanvas")}
        </h4>
      </div>
      <div className="space-y-0.5">
        {ALLOWED_PROVIDERS.map((type) => (
          <ProviderRow key={type} type={type} />
        ))}
      </div>
    </div>
  );
}

function AnalysisTab() {
  const { t } = useTranslation();
  const analysisWebSearch = useAgentSettingsStore((s) => s.analysisWebSearch);
  const analysisEffortLevel = useAgentSettingsStore(
    (s) => s.analysisEffortLevel,
  );
  const analysisPhaseMode = useAgentSettingsStore((s) => s.analysisPhaseMode);
  const analysisCustomPhases = useAgentSettingsStore(
    (s) => s.analysisCustomPhases,
  );
  const setAnalysisWebSearch = useAgentSettingsStore(
    (s) => s.setAnalysisWebSearch,
  );
  const setAnalysisEffortLevel = useAgentSettingsStore(
    (s) => s.setAnalysisEffortLevel,
  );
  const setAnalysisPhaseMode = useAgentSettingsStore(
    (s) => s.setAnalysisPhaseMode,
  );
  const toggleAnalysisPhase = useAgentSettingsStore(
    (s) => s.toggleAnalysisPhase,
  );
  const persist = useAgentSettingsStore((s) => s.persist);

  const selectedAnalysisEffort = analysisEffortLevel ?? "medium";
  const selectedAnalysisWebSearch = analysisWebSearch ?? true;
  const selectedPhaseCount = analysisCustomPhases.length;

  const handleWebSearchChange = useCallback(
    (checked: boolean) => {
      setAnalysisWebSearch(checked);
      persist();
    },
    [persist, setAnalysisWebSearch],
  );

  const handleEffortChange = useCallback(
    (effortLevel: AnalysisEffortLevel) => {
      setAnalysisEffortLevel(effortLevel);
      persist();
    },
    [persist, setAnalysisEffortLevel],
  );

  const handlePhaseModeChange = useCallback(
    (mode: "all" | "custom") => {
      setAnalysisPhaseMode(mode);
      persist();
    },
    [persist, setAnalysisPhaseMode],
  );

  const handlePhaseToggle = useCallback(
    (phase: (typeof V3_PHASES)[number]) => {
      toggleAnalysisPhase(phase);
      persist();
    },
    [persist, toggleAnalysisPhase],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1 px-1">
        <RefreshCw size={12} className="text-muted-foreground" />
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {t("agents.analysisRuntime")}
        </h4>
      </div>

      {/* Web search */}
      <div className="rounded-lg bg-secondary/30 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-foreground">
              {t("agents.analysisWebSearch")}
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              {t("agents.analysisWebSearchHint")}
            </p>
          </div>
          <Switch
            checked={selectedAnalysisWebSearch}
            onCheckedChange={handleWebSearchChange}
            aria-label={t("agents.analysisWebSearch")}
          />
        </div>
      </div>

      {/* Effort level */}
      <div className="rounded-lg bg-secondary/30 px-3 py-2">
        <div className="text-[12px] font-medium text-foreground">
          {t("agents.analysisEffort")}
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          {t("agents.analysisEffortHint")}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {ANALYSIS_EFFORT_OPTIONS.map((effortLevel) => (
            <Button
              key={effortLevel}
              type="button"
              size="sm"
              variant={
                selectedAnalysisEffort === effortLevel ? "default" : "outline"
              }
              onClick={() => handleEffortChange(effortLevel)}
              className="h-8 px-2 text-[11px]"
            >
              {t(ANALYSIS_EFFORT_LABEL_KEYS[effortLevel])}
            </Button>
          ))}
        </div>
      </div>

      {/* Phase selection */}
      <div className="rounded-lg bg-secondary/30 px-3 py-2">
        <div className="text-[12px] font-medium text-foreground">
          {t("agents.analysisPhases")}
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
          {t("agents.analysisPhasesHint")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={analysisPhaseMode === "all" ? "default" : "outline"}
            onClick={() => handlePhaseModeChange("all")}
            className="h-8 px-2 text-[11px]"
          >
            {t("agents.analysisPhasesAll")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={analysisPhaseMode === "custom" ? "default" : "outline"}
            onClick={() => handlePhaseModeChange("custom")}
            className="h-8 px-2 text-[11px]"
          >
            {t("agents.analysisPhasesCustom")}
          </Button>
        </div>

        {analysisPhaseMode === "custom" && (
          <div className="mt-2 space-y-1.5">
            {V3_PHASES.map((phase) => {
              const checked = analysisCustomPhases.includes(phase);
              const disableToggle = checked && selectedPhaseCount === 1;

              return (
                <label
                  key={phase}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-2.5 py-2 text-[11px] transition-colors",
                    checked
                      ? "bg-background/80 text-foreground"
                      : "text-muted-foreground hover:bg-background/50",
                    disableToggle && "cursor-not-allowed opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-input"
                    checked={checked}
                    disabled={disableToggle}
                    onChange={() => handlePhaseToggle(phase)}
                  />
                  <span className="min-w-0 flex-1">{PHASE_LABELS[phase]}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemTab() {
  const { t } = useTranslation();
  const mcpIntegrations = useAgentSettingsStore((s) => s.mcpIntegrations);
  const mcpHttpPort = useAgentSettingsStore((s) => s.mcpHttpPort);
  const toggleMCP = useAgentSettingsStore((s) => s.toggleMCPIntegration);
  const persist = useAgentSettingsStore((s) => s.persist);
  const mcpServerRunning = useAgentSettingsStore((s) => s.mcpServerRunning);
  const setMcpServerStatus = useAgentSettingsStore((s) => s.setMcpServerStatus);

  const [mcpInstalling, setMcpInstalling] = useState<string | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpServerError, setMcpServerError] = useState<string | null>(null);
  const [mcpServerPort, setMcpServerPort] = useState<number>(mcpHttpPort);
  const [configCopied, setConfigCopied] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  // Fetch MCP server status on mount
  useEffect(() => {
    fetch("/api/mcp/server")
      .then((r) => r.json())
      .then(
        (data: {
          running: boolean;
          port: number | null;
          localIp: string | null;
        }) => {
          setMcpServerStatus(data.running, data.localIp);
          if (typeof data.port === "number") {
            setMcpServerPort(data.port);
          }
          setMcpServerError(null);
        },
      )
      .catch(() => {
        setMcpServerError("Unable to read MCP server status.");
      });
  }, [setMcpServerStatus]);

  // Fetch auto-update setting (Electron only)
  useEffect(() => {
    if (!window.electronAPI?.updater?.getAutoCheck) return;
    window.electronAPI.updater
      .getAutoCheck()
      .then(setAutoUpdateEnabled)
      .catch((err) => console.error("[auto-update getAutoCheck]", err));
  }, []);

  const handleAutoUpdateToggle = useCallback(async (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    try {
      await window.electronAPI?.updater?.setAutoCheck?.(enabled);
    } catch (err) {
      console.error("[auto-update toggle]", err);
    }
  }, []);

  const handleCopyConfig = useCallback(() => {
    if (!mcpServerRunning) return;
    const config = JSON.stringify(
      { type: "http", url: `http://127.0.0.1:${mcpServerPort}/mcp` },
      null,
      2,
    );
    navigator.clipboard.writeText(config);
    setConfigCopied(true);
    setTimeout(() => setConfigCopied(false), 2000);
  }, [mcpServerPort, mcpServerRunning]);

  const handleToggleMCP = useCallback(
    async (tool: string) => {
      const current = mcpIntegrations.find((m) => m.tool === tool);
      if (!current) return;
      const action = current.enabled ? "uninstall" : "install";

      setMcpInstalling(tool);
      setMcpError(null);
      try {
        const result = await callMcpInstall(
          tool,
          action,
          undefined,
          mcpServerPort,
        );
        if (result.success) {
          toggleMCP(tool);
          persist();
        } else {
          setMcpError(result.error ?? t("agents.failedTo", { action }));
        }
      } catch {
        setMcpError(t("agents.failedToMcp", { action }));
      } finally {
        setMcpInstalling(null);
      }
    },
    [mcpIntegrations, mcpServerPort, toggleMCP, persist, t],
  );

  const isBusy = mcpInstalling !== null;

  return (
    <div className="space-y-3">
      {/* MCP Server */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <Globe size={12} className="text-muted-foreground" />
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("agents.mcpServer")}
          </h4>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30">
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              mcpServerRunning ? "bg-green-500" : "bg-muted-foreground/30",
            )}
          />
          <span className="text-[12px] text-foreground flex-1">
            {mcpServerRunning
              ? t("agents.mcpServerRunning")
              : t("agents.mcpServerStopped")}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            managed by app
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {t("agents.port")}
          </span>
          <span className="h-6 min-w-[52px] rounded border border-input bg-secondary px-2 text-[11px] leading-6 text-center tabular-nums text-foreground">
            {mcpServerPort}
          </span>
        </div>
        {mcpServerRunning && (
          <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-secondary/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {t("agents.mcpClientConfig")}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyConfig}
                className="shrink-0 h-5 w-5"
              >
                {configCopied ? (
                  <Check size={9} className="text-green-500" />
                ) : (
                  <Copy size={9} />
                )}
              </Button>
            </div>
            <code className="text-[10px] text-muted-foreground font-mono select-all leading-none">{`{ "type": "http", "url": "http://127.0.0.1:${mcpServerPort}/mcp" }`}</code>
          </div>
        )}
        {mcpServerError && (
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <AlertCircle size={11} className="text-destructive shrink-0" />
            <p className="text-[10px] text-destructive">{mcpServerError}</p>
          </div>
        )}
      </div>

      {/* MCP Integrations */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <Terminal size={12} className="text-muted-foreground" />
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("agents.mcpIntegrations")}
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-0">
          {mcpIntegrations
            .filter((m) => ALLOWED_MCP_TOOLS.has(m.tool))
            .map((m) => (
              <div
                key={m.tool}
                className={cn(
                  "flex items-center justify-between py-1.5 px-3 rounded-lg transition-colors",
                  m.enabled ? "bg-secondary/40" : "hover:bg-secondary/20",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-[12px] truncate",
                      m.enabled ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m.displayName}
                  </span>
                  {mcpInstalling === m.tool && (
                    <Loader2
                      size={10}
                      className="animate-spin text-muted-foreground shrink-0"
                    />
                  )}
                </div>
                <Switch
                  checked={m.enabled}
                  disabled={isBusy}
                  onCheckedChange={() => handleToggleMCP(m.tool)}
                  className="shrink-0 ml-2"
                />
              </div>
            ))}
        </div>
        {mcpError && (
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <AlertCircle size={11} className="text-destructive shrink-0" />
            <p className="text-[10px] text-destructive">{mcpError}</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-2 px-1">
          {t("agents.mcpRestart")}
        </p>
      </div>

      {/* Auto-update toggle (Electron only) */}
      {isElectron && (
        <div>
          <div className="h-px bg-border mb-3" />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <RefreshCw size={12} className="text-muted-foreground" />
              <span className="text-[12px] text-foreground">
                {t("agents.autoUpdate")}
              </span>
            </div>
            <Switch
              checked={autoUpdateEnabled}
              onCheckedChange={handleAutoUpdateToggle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

const TAB_DEFINITIONS: { key: SettingsTab; labelKey: string }[] = [
  { key: "providers", labelKey: "settings.tabProviders" },
  { key: "analysis", labelKey: "settings.tabAnalysis" },
  { key: "system", labelKey: "settings.tabSystem" },
];

export default function AgentSettingsDialog() {
  const { t } = useTranslation();
  const open = useAgentSettingsStore((s) => s.dialogOpen);
  const setDialogOpen = useAgentSettingsStore((s) => s.setDialogOpen);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setDialogOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80"
        onClick={() => setDialogOpen(false)}
      />
      <div
        ref={dialogRef}
        className="relative bg-card rounded-xl border border-border w-[480px] max-h-[80vh] overflow-hidden shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-0">
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.title")}
          </h3>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDialogOpen(false)}
          >
            <X size={14} />
          </Button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-0 px-5 pt-2 pb-0">
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.key
                  ? "text-foreground border-amber-500"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border",
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="h-px bg-border" />

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {activeTab === "providers" && <ProvidersTab />}
          {activeTab === "analysis" && <AnalysisTab />}
          {activeTab === "system" && <SystemTab />}
        </div>
      </div>
    </div>
  );
}
