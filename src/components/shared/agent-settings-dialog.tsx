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
  Plug,
  ChevronDown,
  ChevronUp,
  Trash2,
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
import {
  setSecret,
  getSecret,
  hasSecret,
  hasElectronSecretBridge,
  removeSecret,
  probeSecureStorage,
} from "@/utils/secret-storage";
import { pushSearchConfig } from "@/services/ai/search-config-client";
import { PHASE_LABELS, RUNNABLE_PHASES } from "@/types/methodology";
import type { AnalysisEffortLevel } from "../../../shared/types/analysis-runtime";
import ClaudeLogo from "@/components/icons/claude-logo";
import OpenAILogo from "@/components/icons/openai-logo";
import OpenCodeLogo from "@/components/icons/opencode-logo";

/** MCP tools that correspond to allowed providers (claude-code → anthropic, codex-cli → openai) */
const ALLOWED_MCP_TOOLS = new Set(["claude-code", "codex-cli"]);

/** Provider display metadata — labels use PROVIDER_LABELS for allowed providers,
 *  i18n keys for the rest. Descriptions are i18n keys resolved at render time. */
const PROVIDER_META: Record<
  AIProviderType,
  {
    /** Direct display label (not an i18n key) — sourced from PROVIDER_LABELS */
    label: string;
    descriptionKey: string;
    agent: "claude-code" | "codex-cli" | "opencode" | "custom-api";
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
  custom: {
    label: PROVIDER_LABELS.custom,
    descriptionKey: "agents.customProviderDesc",
    agent: "custom-api",
    Icon: Plug,
  },
};

const ANALYSIS_EFFORT_OPTIONS: AnalysisEffortLevel[] = [
  "quick",
  "standard",
  "thorough",
];

const ANALYSIS_EFFORT_LABEL_KEYS: Record<AnalysisEffortLevel, string> = {
  quick: "agents.analysisEffortQuick",
  standard: "agents.analysisEffortStandard",
  thorough: "agents.analysisEffortThorough",
};

async function connectAgent(
  agent: "claude-code" | "codex-cli" | "opencode" | "custom-api",
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
  agent: "claude-code" | "codex-cli" | "opencode" | "custom-api",
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

/** Secret-storage key names (shared with the connect flow and boot push). */
const CUSTOM_API_KEY = "customProvider.apiKey";
const SEARCH_API_KEY = "search.apiKey";
type SecretStorageWarning = "web-plaintext" | "electron-session" | null;

/** Shared class for the custom-provider text/password inputs. */
const CUSTOM_INPUT_CLASS =
  "h-8 w-full rounded-md border border-border bg-secondary/40 px-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring";

interface CustomPreset {
  id: string;
  label: string;
  baseURL: string;
  /** Fallback model IDs used when the endpoint has no /models listing. */
  defaultModelIds: string[];
  hasNativeWebSearch: boolean;
}

/** OpenAI-compatible endpoint presets. Selecting one prefills the base URL and
 *  fallback model IDs; the base URL stays editable afterward. */
const CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: "opencode-go",
    label: "OpenCode Go",
    baseURL: "https://opencode.ai/zen/go/v1",
    defaultModelIds: ["kimi-k2.7-code"],
    hasNativeWebSearch: false,
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    baseURL: "https://opencode.ai/zen/v1",
    defaultModelIds: [],
    hasNativeWebSearch: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModelIds: [],
    hasNativeWebSearch: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    defaultModelIds: ["deepseek-chat", "deepseek-reasoner"],
    hasNativeWebSearch: false,
  },
  {
    id: "custom-url",
    label: "Custom URL",
    baseURL: "",
    defaultModelIds: [],
    hasNativeWebSearch: false,
  },
];

interface ConnectCustomResult {
  connected: boolean;
  models: GroupedModel[];
  error?: string;
  modelListSource?: "endpoint" | "manual";
}

/** POST the custom-provider connect request. The key is sent once to probe the
 *  endpoint; it is persisted only in secret storage, never in settings. */
async function connectCustomAgent(params: {
  baseURL: string;
  apiKey: string;
  modelIds: string[];
}): Promise<ConnectCustomResult> {
  try {
    const res = await fetch("/api/ai/connect-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "custom", ...params }),
    });
    if (!res.ok) {
      return {
        connected: false,
        models: [],
        error: `server_error_${res.status}`,
      };
    }
    return (await res.json()) as ConnectCustomResult;
  } catch {
    return { connected: false, models: [], error: "connection_failed" };
  }
}

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
      // Auto-connect after successful install
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

  // Button logic: connected → Disconnect, installing → spinner, notInstalled (no instructions yet) → Install, else → Connect
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
        {/* Icon */}
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

        {/* Name + description */}
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

        {/* Action */}
        {renderAction()}
      </div>

      {/* Install instructions (shown after install failure) */}
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

function CustomProviderRow() {
  const { t } = useTranslation();
  const provider = useAgentSettingsStore((s) => s.providers.custom);
  const customProvider = useAgentSettingsStore((s) => s.customProvider);
  const searchProvider = useAgentSettingsStore((s) => s.searchProvider);
  const setCustomProvider = useAgentSettingsStore((s) => s.setCustomProvider);
  const setSearchProvider = useAgentSettingsStore((s) => s.setSearchProvider);
  const connect = useAgentSettingsStore((s) => s.connectProvider);
  const disconnect = useAgentSettingsStore((s) => s.disconnectProvider);
  const persist = useAgentSettingsStore((s) => s.persist);

  const meta = PROVIDER_META.custom;
  const { Icon } = meta;

  const [expanded, setExpanded] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [searchKeyInput, setSearchKeyInput] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [hasStoredSearchKey, setHasStoredSearchKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // OS encryption unavailable and the key was NOT usable.
  const [keyNotEncrypted, setKeyNotEncrypted] = useState(false);
  const [storageWarning, setStorageWarning] =
    useState<SecretStorageWarning>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const secure = await probeSecureStorage();
      const [storedKey, storedSearchKey] = await Promise.all([
        hasSecret(CUSTOM_API_KEY),
        hasSecret(SEARCH_API_KEY),
      ]);
      if (cancelled) return;
      setStorageWarning(
        secure
          ? null
          : hasElectronSecretBridge()
            ? "electron-session"
            : "web-plaintext",
      );
      setHasStoredKey(storedKey);
      setHasStoredSearchKey(storedSearchKey);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreset = useCallback(
    (id: string) => {
      const preset =
        CUSTOM_PRESETS.find((p) => p.id === id) ??
        CUSTOM_PRESETS[CUSTOM_PRESETS.length - 1];
      setCustomProvider({
        preset: preset.id,
        baseURL: preset.baseURL,
        modelIds: preset.defaultModelIds,
        hasNativeWebSearch: preset.hasNativeWebSearch,
      });
      persist();
    },
    [setCustomProvider, persist],
  );

  const handleClearKey = useCallback(async () => {
    await removeSecret(CUSTOM_API_KEY);
    setHasStoredKey(false);
    setApiKeyInput("");
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    setKeyNotEncrypted(false);
    setIsConnecting(true);
    try {
      const baseURL = customProvider.baseURL.trim();

      // Persist a newly-typed key before probing the endpoint.
      if (apiKeyInput) {
        const res = await setSecret(CUSTOM_API_KEY, apiKeyInput);
        if (!res.ok) {
          setKeyNotEncrypted(true);
          return;
        }
        setHasStoredKey(true);
      }
      const apiKey = apiKeyInput || (await getSecret(CUSTOM_API_KEY)) || "";

      // Persist + push the web-search config (best-effort; plaintext in web).
      if (searchKeyInput) {
        const sres = await setSecret(SEARCH_API_KEY, searchKeyInput);
        if (sres.ok) setHasStoredSearchKey(true);
      }
      const searchKey =
        searchKeyInput || (await getSecret(SEARCH_API_KEY)) || null;
      await pushSearchConfig({
        provider: searchProvider,
        apiKey: searchProvider ? searchKey : null,
      });

      const result = await connectCustomAgent({
        baseURL,
        apiKey,
        modelIds: customProvider.modelIds,
      });
      if (result.connected) {
        connect("custom", "custom-api", result.models);
        persist();
        setApiKeyInput("");
        setSearchKeyInput("");
      } else if (result.error?.startsWith("server_error_")) {
        const status = result.error.replace("server_error_", "");
        setError(t("agents.serverError", { status }));
      } else if (result.error === "connection_failed") {
        setError(t("agents.connectionFailed"));
      } else {
        setError(result.error ?? t("agents.connectionFailed"));
      }
    } finally {
      setIsConnecting(false);
    }
  }, [
    customProvider.baseURL,
    customProvider.modelIds,
    apiKeyInput,
    searchKeyInput,
    searchProvider,
    connect,
    persist,
    t,
  ]);

  const handleDisconnect = useCallback(() => {
    disconnect("custom");
    persist();
    setError(null);
  }, [disconnect, persist]);

  const canConnect = customProvider.baseURL.trim().length > 0 && !isConnecting;

  return (
    <div className="rounded-lg bg-secondary/30">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-1.5">
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
              {t("agents.customProvider")}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight hidden sm:inline">
              {t("agents.customProviderDesc")}
            </span>
          </div>
          {provider.isConnected && (
            <span className="text-[11px] text-green-500 leading-tight flex items-center gap-1 mt-0.5">
              <Check size={10} strokeWidth={2.5} />
              {t("agents.modelCount", { count: provider.models.length })}
            </span>
          )}
        </div>

        {provider.isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-destructive shrink-0"
          >
            <Unplug size={11} className="mr-1" />
            {t("common.disconnect")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-label={t("agents.customProvider")}
          className="shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>

      {/* Expandable form */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5">
          {/* Preset */}
          <label className="block">
            <span className="text-[11px] text-muted-foreground">
              {t("agents.customPreset")}
            </span>
            <select
              value={customProvider.preset}
              onChange={(e) => applyPreset(e.target.value)}
              className={cn(CUSTOM_INPUT_CLASS, "mt-1")}
            >
              {CUSTOM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {/* Base URL */}
          <label className="block">
            <span className="text-[11px] text-muted-foreground">
              {t("agents.customBaseUrl")}
            </span>
            <input
              type="text"
              value={customProvider.baseURL}
              onChange={(e) => setCustomProvider({ baseURL: e.target.value })}
              onBlur={persist}
              placeholder="https://api.example.com/v1"
              className={cn(CUSTOM_INPUT_CLASS, "mt-1")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {/* API key */}
          <label className="block">
            <span className="text-[11px] text-muted-foreground">
              {t("agents.customApiKey")}
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={hasStoredKey ? "••••••••••••" : ""}
                className={CUSTOM_INPUT_CLASS}
                autoComplete="off"
              />
              {hasStoredKey && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClearKey}
                  aria-label={t("agents.customClearKey")}
                  className="shrink-0"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </label>

          {/* Model IDs */}
          <label className="block">
            <span className="text-[11px] text-muted-foreground">
              {t("agents.customModelIds")}
            </span>
            <input
              type="text"
              value={customProvider.modelIds.join(", ")}
              onChange={(e) =>
                setCustomProvider({
                  modelIds: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              onBlur={persist}
              placeholder="model-a, model-b"
              className={cn(CUSTOM_INPUT_CLASS, "mt-1")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {/* Native web search toggle */}
          <div className="flex items-center gap-3 rounded-md bg-secondary/40 px-2.5 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground">
                {t("agents.customNativeSearch")}
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                {t("agents.customNativeSearchHint")}
              </p>
            </div>
            <Switch
              checked={customProvider.hasNativeWebSearch}
              onCheckedChange={(v) => {
                setCustomProvider({ hasNativeWebSearch: v });
                persist();
              }}
              aria-label={t("agents.customNativeSearch")}
            />
          </div>

          {/* Web search provider section */}
          <div className="rounded-md bg-secondary/40 px-2.5 py-2 space-y-2">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">
                {t("agents.searchProvider")}
              </span>
              <select
                value={searchProvider ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchProvider(v === "tavily" || v === "brave" ? v : null);
                  persist();
                }}
                className={cn(CUSTOM_INPUT_CLASS, "mt-1")}
              >
                <option value="">{t("agents.searchProviderNone")}</option>
                <option value="tavily">Tavily</option>
                <option value="brave">Brave</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">
                {t("agents.searchApiKey")}
              </span>
              <input
                type="password"
                value={searchKeyInput}
                onChange={(e) => setSearchKeyInput(e.target.value)}
                placeholder={hasStoredSearchKey ? "••••••••••••" : ""}
                className={cn(CUSTOM_INPUT_CLASS, "mt-1")}
                autoComplete="off"
              />
            </label>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {t("agents.searchKeyHint")}
            </p>
          </div>

          {/* Warnings */}
          {storageWarning === "web-plaintext" && (
            <p className="text-[10px] leading-relaxed text-amber-500">
              {t("agents.customKeyStoredPlain")}
            </p>
          )}
          {storageWarning === "electron-session" && (
            <p className="text-[10px] leading-relaxed text-amber-500">
              {t("agents.customKeyStoredSession", {
                defaultValue:
                  "OS encryption is unavailable; typed keys are kept only for this app session and cleared on quit.",
              })}
            </p>
          )}
          {keyNotEncrypted && (
            <p className="text-[10px] leading-relaxed text-destructive">
              {t("agents.customKeyNotEncrypted")}
            </p>
          )}
          {error && (
            <p className="text-[10px] leading-relaxed text-destructive">
              {error}
            </p>
          )}

          {/* Connect */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={!canConnect}
              className="h-7 px-3 text-[11px]"
            >
              {isConnecting ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                t("agents.customConnect")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentSettingsDialog() {
  const { t } = useTranslation();
  const open = useAgentSettingsStore((s) => s.dialogOpen);
  const setDialogOpen = useAgentSettingsStore((s) => s.setDialogOpen);
  const mcpIntegrations = useAgentSettingsStore((s) => s.mcpIntegrations);
  const mcpHttpPort = useAgentSettingsStore((s) => s.mcpHttpPort);
  const toggleMCP = useAgentSettingsStore((s) => s.toggleMCPIntegration);
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
  const mcpServerRunning = useAgentSettingsStore((s) => s.mcpServerRunning);
  const setMcpServerStatus = useAgentSettingsStore((s) => s.setMcpServerStatus);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setDialogOpen]);

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

  // Fetch MCP server status on dialog open
  useEffect(() => {
    if (!open) return;
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
  }, [open, setMcpServerStatus]);

  // Fetch auto-update setting on dialog open (Electron only)
  useEffect(() => {
    if (!open || !window.electronAPI?.updater?.getAutoCheck) return;
    window.electronAPI.updater
      .getAutoCheck()
      .then(setAutoUpdateEnabled)
      .catch((err) => console.error("[auto-update getAutoCheck]", err));
  }, [open]);

  const handleAutoUpdateToggle = useCallback(async (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    try {
      await window.electronAPI?.updater?.setAutoCheck?.(enabled);
    } catch (err) {
      console.error("[auto-update toggle]", err);
    }
  }, []);

  const selectedAnalysisEffort = analysisEffortLevel ?? "standard";
  const selectedAnalysisWebSearch = analysisWebSearch ?? true;
  const selectedPhaseCount = analysisCustomPhases.length;

  const handleAnalysisWebSearchChange = useCallback(
    (checked: boolean) => {
      setAnalysisWebSearch(checked);
      persist();
    },
    [persist, setAnalysisWebSearch],
  );

  const handleAnalysisEffortChange = useCallback(
    (effortLevel: AnalysisEffortLevel) => {
      setAnalysisEffortLevel(effortLevel);
      persist();
    },
    [persist, setAnalysisEffortLevel],
  );

  const handleAnalysisPhaseModeChange = useCallback(
    (mode: "all" | "custom") => {
      setAnalysisPhaseMode(mode);
      persist();
    },
    [persist, setAnalysisPhaseMode],
  );

  const handleAnalysisPhaseToggle = useCallback(
    (phase: (typeof RUNNABLE_PHASES)[number]) => {
      toggleAnalysisPhase(phase);
      persist();
    },
    [persist, toggleAnalysisPhase],
  );

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

  if (!open) return null;

  const isBusy = mcpInstalling !== null;

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
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Agents section */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1 px-1">
              <Zap size={12} className="text-muted-foreground" />
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("agents.agentsOnCanvas")}
              </h4>
            </div>
            <div className="space-y-0.5">
              {ALLOWED_PROVIDERS.map((type) =>
                type === "custom" ? (
                  <CustomProviderRow key={type} />
                ) : (
                  <ProviderRow key={type} type={type} />
                ),
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mb-3" />

          {/* Analysis runtime section */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <RefreshCw size={12} className="text-muted-foreground" />
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("agents.analysisRuntime")}
              </h4>
            </div>

            <div className="space-y-2">
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
                    onCheckedChange={handleAnalysisWebSearchChange}
                    aria-label={t("agents.analysisWebSearch")}
                  />
                </div>
              </div>

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
                        selectedAnalysisEffort === effortLevel
                          ? "default"
                          : "outline"
                      }
                      onClick={() => handleAnalysisEffortChange(effortLevel)}
                      className="h-8 px-2 text-[11px]"
                    >
                      {t(ANALYSIS_EFFORT_LABEL_KEYS[effortLevel])}
                    </Button>
                  ))}
                </div>
              </div>

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
                    variant={
                      analysisPhaseMode === "all" ? "default" : "outline"
                    }
                    onClick={() => handleAnalysisPhaseModeChange("all")}
                    className="h-8 px-2 text-[11px]"
                  >
                    {t("agents.analysisPhasesAll")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      analysisPhaseMode === "custom" ? "default" : "outline"
                    }
                    onClick={() => handleAnalysisPhaseModeChange("custom")}
                    className="h-8 px-2 text-[11px]"
                  >
                    {t("agents.analysisPhasesCustom")}
                  </Button>
                </div>

                {analysisPhaseMode === "custom" && (
                  <div className="mt-2 space-y-1.5">
                    {RUNNABLE_PHASES.map((phase) => {
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
                            onChange={() => handleAnalysisPhaseToggle(phase)}
                          />
                          <span className="min-w-0 flex-1">
                            {PHASE_LABELS[phase]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mb-3" />

          {/* MCP Server section */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <Globe size={12} className="text-muted-foreground" />
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("agents.mcpServer")}
              </h4>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30">
              {/* Status indicator */}
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

          {/* Divider */}
          <div className="h-px bg-border mb-3" />

          {/* MCP integrations section */}
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
                          m.enabled
                            ? "text-foreground"
                            : "text-muted-foreground",
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
            <>
              <div className="h-px bg-border my-3" />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
