import { useCallback, useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  Plus,
  FolderOpen,
  Save,
  Download,
  Maximize,
  Minimize,
  Blocks,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ClaudeLogo from "@/components/icons/claude-logo";
import OpenAILogo from "@/components/icons/openai-logo";
import LanguageSelector from "@/components/shared/language-selector";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { saveAnalysis } from "@/services/analysis/analysis-persistence";
import { exportToMarkdown } from "@/services/entity/entity-export";
import type { AIProviderType } from "@/types/agent-settings";
import { countCompletedRunnablePhases } from "@/types/methodology";

const PROVIDER_ICONS: Record<
  AIProviderType,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  anthropic: ClaudeLogo,
  openai: OpenAILogo,
};

const PROVIDER_ORDER: AIProviderType[] = ["anthropic", "openai"];

function AgentStatusButton() {
  const { t } = useTranslation();
  const providers = useAgentSettingsStore((state) => state.providers);
  const mcpIntegrations = useAgentSettingsStore(
    (state) => state.mcpIntegrations,
  );
  const connectedTypes = PROVIDER_ORDER.filter(
    (providerType) => providers[providerType].isConnected,
  );
  const agentCount = connectedTypes.length;
  const mcpCount = mcpIntegrations.filter(
    (integration) => integration.enabled,
  ).length;
  const hasAny = agentCount > 0 || mcpCount > 0;

  const tooltipParts: string[] = [];
  if (agentCount > 0) {
    tooltipParts.push(`${agentCount} agent${agentCount === 1 ? "" : "s"}`);
  }
  if (mcpCount > 0) {
    tooltipParts.push(`${mcpCount} MCP`);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useAgentSettingsStore.getState().setDialogOpen(true)}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {hasAny ? (
            <div className="flex items-center gap-1.5">
              {agentCount > 0 ? (
                <div className="flex items-center -space-x-1.5">
                  {connectedTypes.map((providerType) => {
                    const Icon = PROVIDER_ICONS[providerType];
                    return (
                      <div
                        key={providerType}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/10 ring-1 ring-card"
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Blocks size={14} strokeWidth={1.5} />
              )}
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {tooltipParts.join(" · ")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Blocks size={14} strokeWidth={1.5} />
              <span className={cn("hidden text-[11px] sm:inline")}>
                {t("topbar.agentsAndMcp")}
              </span>
            </div>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {hasAny
          ? `${tooltipParts.join(" · ")} ${t("topbar.connected")}`
          : t("topbar.setupAgentsMcp")}
      </TooltipContent>
    </Tooltip>
  );
}

interface TopBarProps {
  onNewAnalysis: () => void | Promise<void>;
  onOpenAnalysis: () => void | Promise<void>;
}

export default function TopBar({ onNewAnalysis, onOpenAnalysis }: TopBarProps) {
  const { t } = useTranslation();
  const analysis = useEntityGraphStore((state) => state.analysis);
  const fileName = useEntityGraphStore((state) => state.fileName);
  const isDirty = useEntityGraphStore((state) => state.isDirty);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }

    document.documentElement.requestFullscreen();
  }, []);

  const handleSaveAnalysis = useCallback(() => {
    void saveAnalysis();
  }, []);

  const handleExportMarkdown = useCallback(() => {
    const currentAnalysis = useEntityGraphStore.getState().analysis;
    const markdown = exportToMarkdown(currentAnalysis);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentAnalysis.name || "analysis"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const displayName =
    analysis.name.trim() || analysis.topic.trim() || "New Analysis";
  const fileStatusLabel = fileName ?? t("topbar.unsavedFile");
  const entityCount = analysis.entities.length;
  const completedPhases = countCompletedRunnablePhases(analysis.phases);
  const statusLabel =
    entityCount > 0
      ? `${entityCount} entities / ${completedPhases} phases`
      : "No entities";

  return (
    <div className="app-region-drag flex h-10 shrink-0 select-none items-center border-b border-border bg-card px-2">
      <div className="app-region-no-drag electron-traffic-light-pad flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="New analysis"
              onClick={() => void onNewAnalysis()}
              className="h-8"
            >
              <Plus size={16} strokeWidth={1.5} />
              {t("topbar.newAnalysis")}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("topbar.tooltipNew")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Open analysis"
              onClick={() => void onOpenAnalysis()}
              className="h-8"
            >
              <FolderOpen size={16} strokeWidth={1.5} />
              {t("topbar.open")}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("topbar.tooltipOpen")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isDirty ? "default" : "outline"}
              size="sm"
              aria-label="Save analysis"
              onClick={handleSaveAnalysis}
              className="h-8"
            >
              <Save size={16} strokeWidth={1.5} />
              {t("topbar.save")}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t("topbar.tooltipSave")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Export to Markdown"
              onClick={handleExportMarkdown}
              className="h-8"
            >
              <Download size={16} strokeWidth={1.5} />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Export analysis as Markdown
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4">
        <span
          className="truncate text-xs text-foreground"
          suppressHydrationWarning
        >
          {displayName}
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          {fileStatusLabel}
          {isDirty ? ` ${t("topbar.edited")}` : ""}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            entityCount > 0
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-zinc-500/15 text-zinc-300",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="app-region-no-drag electron-win-controls-pad flex items-center gap-0.5">
        <AgentStatusButton />

        <div className="mx-1 h-3.5 w-px bg-border/60" />

        <LanguageSelector />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="text-muted-foreground"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize size={15} strokeWidth={1.5} />
              ) : (
                <Maximize size={15} strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isFullscreen ? t("topbar.exitFullscreen") : t("topbar.fullscreen")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
