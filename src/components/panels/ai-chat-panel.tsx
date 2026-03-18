import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  MessageSquare,
  Loader2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAIStore } from "@/stores/ai-store";
import type { PanelCorner } from "@/stores/ai-store";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { PHASE_LABELS, V1_PHASES } from "@/types/methodology";
import type { AIProviderType } from "@/types/agent-settings";
import ClaudeLogo from "@/components/icons/claude-logo";
import OpenAILogo from "@/components/icons/openai-logo";
import OpenCodeLogo from "@/components/icons/opencode-logo";
import CopilotLogo from "@/components/icons/copilot-logo";
import ChatMessage from "./chat-message";
import { useChatHandlers } from "./ai-chat-handlers";
import { FixedChecklist } from "./ai-chat-checklist";

export type AIChatMode = "analysis";
export type AIChatPresentation = "floating" | "docked";

// ── Example topics for entity-graph welcome state ──

const EXAMPLE_TOPICS = [
  "US-China semiconductor trade war",
  "OPEC+ oil production negotiations",
  "EU AI Act regulatory enforcement",
];

const PROVIDER_ICON: Record<AIProviderType, typeof ClaudeLogo> = {
  anthropic: ClaudeLogo,
  openai: OpenAILogo,
  opencode: OpenCodeLogo,
  copilot: CopilotLogo,
};

const CORNER_CLASSES: Record<PanelCorner, string> = {
  "top-left": "top-3 left-3",
  "top-right": "top-3 right-3",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

function resolveNextModel(
  models: Array<{ value: string }>,
  currentModel: string,
  preferredModel: string,
): string | null {
  if (models.length === 0) return null;
  if (models.some((m) => m.value === currentModel)) return currentModel;
  if (models.some((m) => m.value === preferredModel)) return preferredModel;
  return models[0].value;
}

/**
 * Minimized AI bar — a compact clickable pill.
 * Parent is responsible for placing it in the layout.
 */
export function AIChatMinimizedBar() {
  const isMinimized = useAIStore((s) => s.isMinimized);
  const toggleMinimize = useAIStore((s) => s.toggleMinimize);

  if (!isMinimized) return null;

  return (
    <button
      type="button"
      onClick={toggleMinimize}
      className="h-8 bg-card border border-border rounded-lg flex items-center gap-1.5 px-3 shadow-lg hover:bg-accent transition-colors"
    >
      <MessageSquare size={13} className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
        {useAIStore.getState().chatTitle}
      </span>
      <ChevronUp size={12} className="text-muted-foreground" />
    </button>
  );
}

/**
 * Expanded AI chat panel — floating, draggable.
 * Only renders when NOT minimized.
 */
export default function AIChatPanel({
  mode = "analysis",
  presentation = "floating",
  onStartAnalysis,
}: {
  mode?: AIChatMode;
  presentation?: AIChatPresentation;
  onStartAnalysis?: (topic: string) => void;
}) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{
    startY: number;
    startHeight: number;
    startTop: number;
  } | null>(null);
  const [dragStyle, setDragStyle] = useState<React.CSSProperties | null>(null);
  const [panelHeight, setPanelHeight] = useState(400); // Default height

  const messages = useAIStore((s) => s.messages);
  const isStreaming = useAIStore((s) => s.isStreaming);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const panelCorner = useAIStore((s) => s.panelCorner);
  const isMinimized = useAIStore((s) => s.isMinimized);
  const setPanelCorner = useAIStore((s) => s.setPanelCorner);
  const chatTitle = useAIStore((s) => s.chatTitle);
  const stopStreaming = useAIStore((s) => s.stopStreaming);
  const toggleMinimize = useAIStore((s) => s.toggleMinimize);
  const hydrateModelPreference = useAIStore((s) => s.hydrateModelPreference);
  const model = useAIStore((s) => s.model);
  const setModel = useAIStore((s) => s.setModel);
  const selectModel = useAIStore((s) => s.selectModel);
  const availableModels = useAIStore((s) => s.availableModels);
  const setAvailableModels = useAIStore((s) => s.setAvailableModels);
  const modelGroups = useAIStore((s) => s.modelGroups);
  const setModelGroups = useAIStore((s) => s.setModelGroups);
  const isLoadingModels = useAIStore((s) => s.isLoadingModels);
  const setLoadingModels = useAIStore((s) => s.setLoadingModels);
  const providers = useAgentSettingsStore((s) => s.providers);
  const providersHydrated = useAgentSettingsStore((s) => s.isHydrated);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const { input, setInput, handleSend } = useChatHandlers();
  // Entity graph state
  const entityGraphPhases = useEntityGraphStore((s) => s.analysis.phases);
  const entityGraphEntities = useEntityGraphStore((s) => s.analysis.entities);
  const analysisId = useEntityGraphStore((s) => s.analysis.id);

  const noAvailableModels = !isLoadingModels && availableModels.length === 0;
  const canUseModel = !isLoadingModels && availableModels.length > 0;
  const canSendMessage = canUseModel && !isStreaming && !!input.trim();
  const quickActionsDisabled = !canUseModel || isStreaming;
  const isDocked = presentation === "docked";
  const isAnalysisMode = mode === "analysis";
  const hasOnStartAnalysis = typeof onStartAnalysis === "function";
  const previousAnalysisIdRef = useRef<string | null>(null);

  // Track entity graph phase changes and inject status messages into chat
  const prevEntityPhasesRef = useRef<string>("");
  useEffect(() => {
    const key = entityGraphPhases
      .map((ps) => `${ps.phase}:${ps.status}`)
      .join(",");
    if (key === prevEntityPhasesRef.current) return;
    prevEntityPhasesRef.current = key;

    // Find phases that just changed to running or complete
    for (const ps of entityGraphPhases) {
      if (ps.status === "running") {
        const label = PHASE_LABELS[ps.phase];
        const phaseNum = V1_PHASES.indexOf(ps.phase) + 1;
        if (phaseNum > 0) {
          useAIStore.getState().addMessage({
            id: `phase-${ps.phase}-start`,
            role: "assistant",
            content: `Starting Phase ${phaseNum}: ${label}...`,
            timestamp: Date.now(),
          });
        }
      }
    }
  }, [entityGraphPhases]);

  // Show completion message when all V1 phases are done
  const prevCompleteRef = useRef(false);
  useEffect(() => {
    const v1Statuses = entityGraphPhases
      .filter((ps) => (V1_PHASES as readonly string[]).includes(ps.phase))
      .map((ps) => ps.status);
    const allComplete =
      v1Statuses.length > 0 && v1Statuses.every((s) => s === "complete");
    if (allComplete && !prevCompleteRef.current) {
      prevCompleteRef.current = true;
      useAIStore.getState().addMessage({
        id: "analysis-complete",
        role: "assistant",
        content: `Analysis complete. ${entityGraphEntities.length} entities identified across ${v1Statuses.length} phases. Click any entity on the canvas to inspect.`,
        timestamp: Date.now(),
      });
    } else if (!allComplete) {
      prevCompleteRef.current = false;
    }
  }, [entityGraphPhases, entityGraphEntities.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ensure model preference is restored from localStorage on page refresh.
  useEffect(() => {
    hydrateModelPreference();
  }, [hydrateModelPreference]);

  // Build model list strictly from connected providers in agent-settings-store.
  // If none are connected, model list is empty.
  useEffect(() => {
    if (!providersHydrated) {
      setLoadingModels(true);
      return;
    }

    const connectedProviders = (
      Object.keys(providers) as AIProviderType[]
    ).filter(
      (p) => providers[p].isConnected && (providers[p].models?.length ?? 0) > 0,
    );

    if (connectedProviders.length > 0) {
      // Build groups + flat list from stored models
      const providerNames: Record<AIProviderType, string> = {
        anthropic: "Anthropic",
        openai: "OpenAI",
        opencode: "OpenCode",
        copilot: "GitHub Copilot",
      };
      const groups = connectedProviders.map((p) => ({
        provider: p,
        providerName: providerNames[p],
        models: providers[p].models,
      }));
      const flat = groups.flatMap((g) =>
        g.models.map((m) => ({
          value: m.value,
          displayName: m.displayName,
          description: m.description,
        })),
      );
      setModelGroups(groups);
      setAvailableModels(flat);
      // Keep current when valid; otherwise restore remembered model; otherwise fallback to first.
      const { model: currentModel, preferredModel } = useAIStore.getState();
      const nextModel = resolveNextModel(flat, currentModel, preferredModel);
      if (nextModel && nextModel !== currentModel) {
        setModel(nextModel);
      }
      setLoadingModels(false);
      return;
    }

    // No providers connected — no available models.
    setModelGroups([]);
    setAvailableModels([]);
    setLoadingModels(false);
  }, [providers, providersHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close model dropdown when clicking outside
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [modelDropdownOpen]);

  // Auto-expand when streaming starts while minimized
  useEffect(() => {
    if (isStreaming && isMinimized) {
      toggleMinimize();
    }
  }, [isStreaming, isMinimized, toggleMinimize]);

  useEffect(() => {
    if (!isAnalysisMode) return;

    const previousAnalysisId = previousAnalysisIdRef.current;
    previousAnalysisIdRef.current = analysisId;
    if (previousAnalysisId === null || previousAnalysisId === analysisId) {
      return;
    }

    stopStreaming();
    clearMessages();
  }, [analysisId, clearMessages, isAnalysisMode, stopStreaming]);

  /* --- Drag-to-snap handlers --- */

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, select"))
      return;

    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - panelRect.left,
      offsetY: e.clientY - panelRect.top,
    };

    e.currentTarget.setPointerCapture(e.pointerId);

    const container = panel.parentElement!;
    const containerRect = container.getBoundingClientRect();
    setDragStyle({
      left: panelRect.left - containerRect.left,
      top: panelRect.top - containerRect.top,
      right: "auto",
      bottom: "auto",
    });
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;

    const panel = panelRef.current;
    if (!panel) return;

    const container = panel.parentElement!;
    const containerRect = container.getBoundingClientRect();
    setDragStyle({
      left: e.clientX - containerRect.left - dragRef.current.offsetX,
      top: e.clientY - containerRect.top - dragRef.current.offsetY,
      right: "auto",
      bottom: "auto",
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;

    const panel = panelRef.current;
    if (!panel) return;

    const container = panel.parentElement!;
    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const centerX = panelRect.left + panelRect.width / 2 - containerRect.left;
    const centerY = panelRect.top + panelRect.height / 2 - containerRect.top;

    const isLeft = centerX < containerRect.width / 2;
    const isTop = centerY < containerRect.height / 2;

    const corner: PanelCorner = isLeft
      ? isTop
        ? "top-left"
        : "bottom-left"
      : isTop
        ? "top-right"
        : "bottom-right";

    setPanelCorner(corner);
    dragRef.current = null;
    setDragStyle(null);
  }, [setPanelCorner]);

  /* --- Resize handlers --- */
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = panelRef.current;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      const container = panel.parentElement!.getBoundingClientRect();

      // If we're not already in absolute positioning mode, snap to it now
      // so resizing works smoothly from the current visual position
      if (!dragStyle) {
        setDragStyle({
          left: rect.left - container.left,
          top: rect.top - container.top,
          width: 320,
          height: rect.height,
        });
      }

      resizeRef.current = {
        startY: e.clientY,
        startHeight: rect.height,
        startTop: rect.top - container.top,
      };

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [dragStyle],
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const deltaY = e.clientY - resizeRef.current.startY;
    // Dragging top handle up (negative delta) -> increase height, decrease top
    // Dragging top handle down (positive delta) -> decrease height, increase top

    let newHeight = resizeRef.current.startHeight - deltaY;
    let newTop = resizeRef.current.startTop + deltaY;

    // Constrain height
    if (newHeight < 200) {
      const diff = 200 - newHeight;
      newHeight = 200;
      newTop -= diff; // correct top if we hit min height
    }
    if (newHeight > 1200) {
      const diff = newHeight - 1200;
      newHeight = 1200;
      newTop += diff; // correct top if we hit max height
    }

    setPanelHeight(newHeight);
    setDragStyle((prev) => ({
      ...prev,
      top: newTop,
      height: newHeight,
    }));
  }, []);

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // Wrap send to intercept topic messages for the orchestrator
  const handleSendWrapped = useCallback(
    (text?: string) => {
      const messageText = text ?? input.trim();
      if (!messageText) return;

      // If onStartAnalysis is provided and this is the first message (or starts with "analyze"),
      // treat it as a topic submission for the orchestrator
      if (
        hasOnStartAnalysis &&
        (messages.length === 0 ||
          messageText.toLowerCase().startsWith("analyze"))
      ) {
        const topic = messageText.replace(/^analyze\s+/i, "").trim();
        if (topic) {
          // Add user message to chat
          useAIStore.getState().addMessage({
            id: `user-${Date.now()}`,
            role: "user",
            content: messageText,
            timestamp: Date.now(),
          });
          useAIStore.getState().addMessage({
            id: `analyst-intro-${Date.now()}`,
            role: "assistant",
            content: `Starting game-theoretic analysis of "${topic}"...`,
            timestamp: Date.now(),
          });
          useAIStore
            .getState()
            .setChatTitle(
              topic.length > 30 ? `${topic.slice(0, 30)}...` : topic,
            );
          setInput("");
          onStartAnalysis!(topic);
          return;
        }
      }

      // Otherwise delegate to the standard chat handler
      handleSend(text);
    },
    [
      input,
      messages.length,
      hasOnStartAnalysis,
      onStartAnalysis,
      handleSend,
      setInput,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendWrapped();
    }
  };

  // Don't render when minimized — the minimized bar is rendered by parent
  if (!isDocked && isMinimized) return null;

  const emptyStateLabel =
    "I'm your game theory analyst. What event do you want to analyze?";
  const emptyStateHint =
    "I'll identify players, strategies, and game structure automatically.";
  const inputPlaceholder = isStreaming
    ? t("ai.generating")
    : "Describe an event to analyze...";
  const displayTitle =
    messages.length === 0 ? "Game Theory Analyst" : chatTitle;

  return (
    <div
      ref={panelRef}
      className={cn(
        isDocked
          ? "flex h-[480px] min-h-0 flex-col xl:h-[calc(100vh-12rem)]"
          : "absolute z-50 flex w-[320px] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-sm",
        !isDocked && !dragStyle && CORNER_CLASSES[panelCorner],
      )}
      style={isDocked ? undefined : { ...dragStyle, height: panelHeight }}
    >
      {!isDocked && (
        <div
          className="absolute -top-1.5 left-0 right-0 z-50 flex h-3 cursor-ns-resize items-center justify-center transition-colors group hover:bg-primary/20"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        >
          <div className="h-1 w-8 rounded-full bg-border transition-colors group-hover:bg-primary/50" />
        </div>
      )}

      {/* --- Header (draggable) --- */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-1 py-1 select-none",
          isDocked ? "" : "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={isDocked ? undefined : handleDragStart}
        onPointerMove={isDocked ? undefined : handleDragMove}
        onPointerUp={isDocked ? undefined : handleDragEnd}
      >
        <div className="flex items-center gap-1">
          {!isDocked && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleMinimize}
              title={t("ai.collapse")}
            >
              <ChevronDown size={14} />
            </Button>
          )}
          <span
            className={cn(
              "max-w-[160px] truncate overflow-hidden text-ellipsis text-sm font-medium text-foreground",
              isDocked ? "px-2" : "",
            )}
            title={displayTitle}
          >
            {displayTitle}
          </span>
          {isStreaming && (
            <Loader2
              size={13}
              className="animate-spin text-muted-foreground ml-2"
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearMessages}
          title={t("ai.newChat")}
        >
          <Plus size={14} />
        </Button>
      </div>

      {/* --- Messages --- */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-background/80 px-3.5 py-3",
          isDocked ? "rounded-xl" : "rounded-b-xl",
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4">
            <p className="text-xs text-muted-foreground mb-4">
              {emptyStateLabel}
            </p>
            <div className="flex flex-col gap-2 w-full px-2">
              {EXAMPLE_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleSendWrapped(topic)}
                  disabled={quickActionsDisabled}
                  className={cn(
                    "text-xs text-left px-3.5 py-1.5 rounded-full bg-secondary/50 border border-border text-muted-foreground transition-colors",
                    quickActionsDisabled
                      ? "cursor-default"
                      : "hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-5">
              {emptyStateHint}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.isStreaming && isStreaming}
              attachments={msg.attachments}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- Fixed Checklist --- */}
      <FixedChecklist messages={messages} isStreaming={isStreaming} />

      {/* --- Input area --- */}
      <div
        className={cn(
          "relative border-t border-border bg-card",
          isDocked ? "rounded-xl" : "rounded-b-xl",
        )}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          disabled={isStreaming}
          rows={2}
          className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground px-3.5 pt-3 pb-2 resize-none outline-none max-h-28 min-h-[52px]"
        />

        {/* --- Bottom bar: model selector + actions --- */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Model selector */}
          <button
            type="button"
            onClick={() => setModelDropdownOpen((v) => !v)}
            disabled={isLoadingModels || availableModels.length === 0}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary"
          >
            {(() => {
              const currentProvider = modelGroups.find((g) =>
                g.models.some((m) => m.value === model),
              )?.provider;
              if (currentProvider) {
                const ProvIcon = PROVIDER_ICON[currentProvider];
                return <ProvIcon className="w-3.5 h-3.5 shrink-0" />;
              }
              return null;
            })()}
            <span className="truncate max-w-[100px]">
              {isLoadingModels
                ? t("ai.loadingModels")
                : noAvailableModels
                  ? t("ai.noModelsConnected")
                  : (availableModels.find((m) => m.value === model)
                      ?.displayName ?? model)}
            </span>
            <ChevronUp size={10} className="shrink-0" />
          </button>

          <div className="flex items-center gap-1 w-full">
            <div className="ml-auto flex items-center gap-0.5">
              {isStreaming ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={stopStreaming}
                  title={t("ai.stopGenerating")}
                  className="shrink-0 rounded-lg h-7 w-7 text-destructive hover:text-destructive hover:scale-110 active:scale-95 transition-all duration-150"
                >
                  <Square size={10} fill="currentColor" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleSendWrapped()}
                  disabled={!canSendMessage}
                  title={t("ai.sendMessage")}
                  className={cn(
                    "shrink-0 rounded-lg h-7 w-7 transition-all duration-150",
                    canSendMessage
                      ? "text-foreground hover:text-primary hover:scale-110 active:scale-95"
                      : "text-muted-foreground/30",
                  )}
                >
                  <Send size={13} />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Upward model dropdown */}
        {modelDropdownOpen && availableModels.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 z-[60] rounded-lg border border-border bg-card shadow-xl py-1 max-h-72 overflow-y-auto">
            {modelGroups.length > 0
              ? modelGroups.map((group) => {
                  const GIcon = PROVIDER_ICON[group.provider];
                  return (
                    <div key={group.provider}>
                      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                        <GIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.providerName}
                        </span>
                      </div>
                      {group.models.map((m, idx) => {
                        const isSelected = m.value === model;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                              selectModel(m.value);
                              setModelDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                              isSelected
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            <span className="w-3.5 shrink-0">
                              {isSelected && <Check size={12} />}
                            </span>
                            <span className="font-medium">{m.displayName}</span>
                            {idx === 0 && (
                              <span className="text-[9px] text-muted-foreground bg-secondary px-1 py-0.5 rounded ml-auto">
                                {t("common.best")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              : availableModels.map((m) => {
                  const isSelected = m.value === model;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        selectModel(m.value);
                        setModelDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                        isSelected
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span className="w-3.5 shrink-0">
                        {isSelected && <Check size={12} />}
                      </span>
                      <span className="font-medium">{m.displayName}</span>
                    </button>
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
}
