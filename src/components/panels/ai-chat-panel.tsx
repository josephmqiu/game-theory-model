import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  MessageSquare,
  Loader2,
  Square,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { useAIStore } from "@/stores/ai-store";
import type { PanelCorner } from "@/stores/ai-store";
import { useThreadStore } from "@/stores/thread-store";
import { QuestionCard } from "./question-card";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { useRunStatusStore } from "@/stores/run-status-store";
import type { ConnectionState } from "@/stores/run-status-store";

import type { ChatMessage as ChatMessageType } from "@/services/ai/ai-types";
import type { AIProviderType } from "@/types/agent-settings";
import {
  PROVIDER_LABELS,
  isAllowedProvider,
} from "@/services/ai/allowed-providers";
import * as analysisClient from "@/services/ai/analysis-client";
import {
  projectThreadMessagesToChatMessages,
  projectPendingTurnToMessages,
  buildTranscript,
  type TranscriptEntry,
} from "@/services/ai/thread-projection";
import ClaudeLogo from "@/components/icons/claude-logo";
import CodexLogo from "@/components/icons/codex-logo";
import { V3_PHASES } from "@/types/methodology";
import type { AnalysisEffortLevel } from "../../../shared/types/analysis-runtime";
import ChatMessage from "./chat-message";
import { ActivityCard } from "./activity-card";
import { PhaseDivider } from "./phase-divider";
import { PlanPreviewCard } from "./plan-preview-card";
import { useChatHandlers } from "./ai-chat-handlers";
import { FixedChecklist } from "./ai-chat-checklist";
import { buildAnalysisCompleteMessage } from "./ai-chat-lifecycle";

export type AIChatMode = "analysis";
export type AIChatPresentation = "floating" | "docked";

const PROVIDER_ICON: Record<AIProviderType, typeof ClaudeLogo> = {
  claude: ClaudeLogo,
  codex: CodexLogo,
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

type AnalysisTerminalStatus = "completed" | "failed" | "cancelled";

function getAnalysisTerminalNoticeKey(
  runId: string,
  terminalStatus: AnalysisTerminalStatus,
): string {
  return `analysis-terminal-${terminalStatus}-${runId}`;
}

function buildAnalysisTerminalMessage(
  runId: string,
  terminalStatus: AnalysisTerminalStatus,
  entityCount: number,
): ChatMessageType {
  if (terminalStatus === "completed") {
    return buildAnalysisCompleteMessage(runId, entityCount);
  }

  const statusLabel = terminalStatus === "failed" ? "failed" : "cancelled";
  return {
    id: getAnalysisTerminalNoticeKey(runId, terminalStatus),
    role: "assistant",
    content: `Analysis ${statusLabel} for run ${runId}. ${entityCount} entities remain on the canvas.`,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tool-call status message — compact inline display for MCP tool activity
// ---------------------------------------------------------------------------

function isToolMessage(id: string): boolean {
  return id.startsWith("tool-");
}

function formatQuestionAnswer(pq: {
  question: { options?: Array<{ label: string }> };
  answer?: { selectedOptions?: number[]; customText?: string };
}): string {
  if (!pq.answer) return "";
  const parts: string[] = [];
  if (pq.answer.selectedOptions?.length && pq.question.options) {
    const labels = pq.answer.selectedOptions
      .map((i) => pq.question.options![i]?.label)
      .filter(Boolean);
    parts.push(labels.join(", "));
  }
  if (pq.answer.customText) {
    parts.push(pq.answer.customText);
  }
  return parts.join(" — ") || "(no answer)";
}

type ToolStatus = "running" | "done" | "error";

export function resolveToolStatus(
  message: Pick<ChatMessageType, "isStreaming" | "toolStatus">,
  chatIsStreaming: boolean,
): ToolStatus {
  if (message.toolStatus) {
    return message.toolStatus;
  }

  return message.isStreaming && chatIsStreaming ? "running" : "done";
}

function ToolStatusMessage({
  content,
  status,
}: {
  content: string;
  status: ToolStatus;
}) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 my-0.5">
      <div
        className={cn(
          "flex items-center justify-center w-4 h-4 rounded shrink-0",
          status === "running" && "text-muted-foreground",
          status === "done" && "text-emerald-500/80",
          status === "error" && "text-destructive/80",
        )}
      >
        {status === "running" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : status === "done" ? (
          <Wrench size={12} />
        ) : (
          <AlertCircle size={12} />
        )}
      </div>
      <span
        className={cn(
          "text-[11px] font-medium",
          status === "running" && "text-muted-foreground",
          status === "done" && "text-muted-foreground/80",
          status === "error" && "text-destructive/80",
        )}
      >
        {content}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection state indicator
// ---------------------------------------------------------------------------

const CONNECTION_DOT_CLASSES: Record<ConnectionState, string> = {
  CONNECTED: "bg-green-500",
  CONNECTING: "bg-amber-500 animate-pulse",
  RECOVERING: "bg-amber-500 animate-pulse",
  DISCONNECTED: "bg-destructive/60",
};

const CONNECTION_LABEL_KEYS: Record<ConnectionState, string> = {
  CONNECTED: "connection.connected",
  CONNECTING: "connection.connecting",
  RECOVERING: "connection.recovering",
  DISCONNECTED: "connection.disconnected",
};

function ConnectionIndicator() {
  const { t } = useTranslation();
  const connectionState = useRunStatusStore((s) => s.connectionState);

  // Don't show anything when connected — save space
  if (connectionState === "CONNECTED") return null;

  return (
    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-secondary/40">
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          CONNECTION_DOT_CLASSES[connectionState],
        )}
      />
      <span className="text-[10px] text-muted-foreground">
        {t(CONNECTION_LABEL_KEYS[connectionState])}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan preview card wrapper — reads settings from stores
// ---------------------------------------------------------------------------

function PlanPreviewCardWrapper({
  topic,
  model,
  availableModels,
}: {
  topic: string;
  model: string;
  availableModels: Array<{ value: string; displayName: string }>;
}) {
  const analysisPhaseMode = useAgentSettingsStore((s) => s.analysisPhaseMode);
  const analysisCustomPhases = useAgentSettingsStore(
    (s) => s.analysisCustomPhases,
  );
  const analysisEffortLevel = useAgentSettingsStore(
    (s) => s.analysisEffortLevel,
  );
  const analysisWebSearch = useAgentSettingsStore((s) => s.analysisWebSearch);

  const phases =
    analysisPhaseMode === "custom" ? analysisCustomPhases : [...V3_PHASES];
  const effort: AnalysisEffortLevel = analysisEffortLevel ?? "medium";
  const webSearch = analysisWebSearch ?? true;
  const modelDisplayName = availableModels.find(
    (m) => m.value === model,
  )?.displayName;

  return (
    <PlanPreviewCard
      topic={topic}
      phases={phases}
      model={model}
      modelDisplayName={modelDisplayName}
      effort={effort}
      webSearch={webSearch}
      onApprove={(settings) => {
        // Start analysis with the approved settings
        const runtime = {
          webSearch: settings.webSearch,
          effortLevel: settings.effort,
          activePhases: settings.phases,
        };
        useAIStore.getState().setPendingPlan(null);
        analysisClient.startAnalysis(topic, undefined, model, runtime);
      }}
      onCancel={() => useAIStore.getState().setPendingPlan(null)}
    />
  );
}

/**
 * Minimized AI bar — a compact clickable pill.
 * Parent is responsible for placing it in the layout.
 */
export function AIChatMinimizedBar() {
  const isMinimized = useAIStore((s) => s.isMinimized);
  const toggleMinimize = useAIStore((s) => s.toggleMinimize);
  const activeThreadTitle = useThreadStore(
    (s) =>
      s.activeThreadDetail?.thread.title ??
      s.threads.find((thread) => thread.id === s.activeThreadId)?.title,
  );

  if (!isMinimized) return null;

  return (
    <button
      type="button"
      onClick={toggleMinimize}
      className="h-8 bg-card border border-border rounded-lg flex items-center gap-1.5 px-3 shadow-lg hover:bg-accent transition-colors"
    >
      <MessageSquare size={13} className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
        {activeThreadTitle || "Analysis Chat"}
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
}: {
  mode?: AIChatMode;
  presentation?: AIChatPresentation;
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

  const isStreaming = useAIStore((s) => s.isStreaming);
  const panelCorner = useAIStore((s) => s.panelCorner);
  const isMinimized = useAIStore((s) => s.isMinimized);
  const setPanelCorner = useAIStore((s) => s.setPanelCorner);
  const stopStreaming = useAIStore((s) => s.stopStreaming);
  const toggleMinimize = useAIStore((s) => s.toggleMinimize);
  const hydrateModelPreference = useAIStore((s) => s.hydrateModelPreference);
  const model = useAIStore((s) => s.model);
  const selectModel = useAIStore((s) => s.selectModel);
  const availableModels = useAIStore((s) => s.availableModels);
  const setAvailableModels = useAIStore((s) => s.setAvailableModels);
  const modelGroups = useAIStore((s) => s.modelGroups);
  const setModelGroups = useAIStore((s) => s.setModelGroups);
  const isLoadingModels = useAIStore((s) => s.isLoadingModels);
  const setLoadingModels = useAIStore((s) => s.setLoadingModels);
  const threads = useThreadStore((s) => s.threads);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const activeThreadDetail = useThreadStore((s) => s.activeThreadDetail);
  const latestRun = useThreadStore((s) => s.latestRun);
  const pendingTurn = useThreadStore((s) => s.pendingTurn);
  const isLoadingThreads = useThreadStore((s) => s.isLoading);
  const isCreatingThread = useThreadStore((s) => s.isCreating);
  const threadError = useThreadStore((s) => s.error);
  const selectThread = useThreadStore((s) => s.selectThread);
  const createThread = useThreadStore((s) => s.createThread);
  const pendingQuestions = useThreadStore((s) => s.pendingQuestions);
  const activeQuestionIndex = useThreadStore((s) => s.activeQuestionIndex);
  const resolveQuestion = useThreadStore((s) => s.resolveQuestion);
  const providers = useAgentSettingsStore((s) => s.providers);
  const providersHydrated = useAgentSettingsStore((s) => s.isHydrated);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const { input, setInput, handleSend } = useChatHandlers();
  const analysisId = useEntityGraphStore((s) => s.analysis.id);

  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [notices, setNotices] = useState<ChatMessageType[]>([]);

  const noAvailableModels = !isLoadingModels && availableModels.length === 0;
  const canUseModel = !isLoadingModels && availableModels.length > 0;
  const hasActivePendingQuestion = pendingQuestions.some(
    (pq) => pq.status === "pending",
  );
  const canSendMessage =
    canUseModel && !isStreaming && !hasActivePendingQuestion && !!input.trim();
  const isDocked = presentation === "docked";
  const isAnalysisMode = mode === "analysis";
  const previousAnalysisIdRef = useRef<string | null>(null);
  const terminalNoticeKeysRef = useRef<Set<string>>(new Set());
  const pendingPlan = useAIStore((s) => s.pendingPlan);
  const runStatusForTranscript = useRunStatusStore((s) => s.runStatus);
  const projectedMessages = useMemo(
    () =>
      projectThreadMessagesToChatMessages(activeThreadDetail?.messages ?? []),
    [activeThreadDetail?.messages],
  );
  const messages = useMemo(() => {
    const base =
      notices.length > 0
        ? [...projectedMessages, ...notices]
        : projectedMessages;
    return pendingTurn
      ? [...base, ...projectPendingTurnToMessages(pendingTurn)]
      : base;
  }, [pendingTurn, projectedMessages, notices]);
  // Build unified transcript when we have activities
  const transcript: TranscriptEntry[] = useMemo(() => {
    const activities = activeThreadDetail?.activities ?? [];
    if (activities.length === 0) return [];
    return buildTranscript(activeThreadDetail?.messages ?? [], activities, {
      activePhase: runStatusForTranscript.activePhase,
    });
  }, [
    activeThreadDetail?.messages,
    activeThreadDetail?.activities,
    runStatusForTranscript.activePhase,
  ]);
  const hasTranscript = transcript.length > 0;
  const activeThreadTitle =
    activeThreadDetail?.thread.title ??
    threads.find((thread) => thread.id === activeThreadId)?.title;

  // Poll analysis orchestrator running state
  useEffect(() => {
    const interval = setInterval(() => {
      const running = analysisClient.isRunning();
      setAnalysisRunning((prev) => (prev !== running ? running : prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Reconciliation timeout: if the pending turn is stuck in "reconciling"
  // state (server confirmed but thread-detail push hasn't arrived), force
  // a refresh after 5s and a hard clear after 10s.
  useEffect(() => {
    if (pendingTurn?.status !== "reconciling") return;

    const refreshTimer = setTimeout(() => {
      const store = useThreadStore.getState();
      if (store.pendingTurn?.status === "reconciling") {
        void store.refreshActiveThreadDetail();
      }
    }, 5_000);

    const clearTimer = setTimeout(() => {
      const store = useThreadStore.getState();
      if (store.pendingTurn?.status === "reconciling") {
        store.clearPendingTurn();
      }
    }, 10_000);

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(clearTimer);
    };
  }, [pendingTurn?.status]);

  // Enhanced stop handler: aborts analysis orchestrator if running,
  // otherwise falls through to regular chat stream abort
  const handleStop = useCallback(() => {
    if (analysisClient.isRunning()) {
      analysisClient.abort();
    }
    stopStreaming();
  }, [stopStreaming]);

  // Completion notices now follow canonical run status instead of terminal progress events.
  useEffect(() => {
    let previousStatus = useRunStatusStore.getState().runStatus;
    return useRunStatusStore.subscribe((state) => {
      const nextStatus = state.runStatus;
      const wasAnalysisRun =
        previousStatus.status === "running" &&
        previousStatus.kind === "analysis";

      if (wasAnalysisRun) {
        const entityCount =
          useEntityGraphStore.getState().analysis.entities.length;

        if (nextStatus.status === "idle" && previousStatus.runId) {
          const noticeKey = getAnalysisTerminalNoticeKey(
            previousStatus.runId,
            "completed",
          );
          if (!terminalNoticeKeysRef.current.has(noticeKey)) {
            terminalNoticeKeysRef.current.add(noticeKey);
            setNotices((prev) => [
              ...prev,
              buildAnalysisTerminalMessage(
                previousStatus.runId!,
                "completed",
                entityCount,
              ),
            ]);
          }
        } else if (
          (nextStatus.status === "failed" ||
            nextStatus.status === "cancelled") &&
          nextStatus.runId
        ) {
          const noticeKey = getAnalysisTerminalNoticeKey(
            nextStatus.runId,
            nextStatus.status,
          );
          if (!terminalNoticeKeysRef.current.has(noticeKey)) {
            terminalNoticeKeysRef.current.add(noticeKey);
            setNotices((prev) => [
              ...prev,
              buildAnalysisTerminalMessage(
                nextStatus.runId!,
                nextStatus.status as AnalysisTerminalStatus,
                entityCount,
              ),
            ]);
          }
        }
      }

      previousStatus = nextStatus;
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear ephemeral notices when switching threads.
  useEffect(() => {
    setNotices([]);
    terminalNoticeKeysRef.current.clear();
  }, [activeThreadId]);

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
      // Build groups + flat list from stored models.
      // Use PROVIDER_LABELS for allowed providers, fall back to raw provider id.
      const groups = connectedProviders.map((p) => ({
        provider: p,
        providerName: isAllowedProvider(p) ? PROVIDER_LABELS[p] : p,
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
        // Use selectModel to also update the persisted preference,
        // clearing any stale model that no longer exists in the available list.
        useAIStore.getState().selectModel(nextModel);
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
    terminalNoticeKeysRef.current.clear();
    setNotices([]);
    if (previousAnalysisId === null || previousAnalysisId === analysisId) {
      return;
    }

    // Only stop streaming when the active analysis changes.
    // Chat history is preserved so a scoping conversation can carry forward
    // into the analysis the user chooses to run.
    stopStreaming();
  }, [analysisId, isAnalysisMode, stopStreaming]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render when minimized — the minimized bar is rendered by parent
  if (!isDocked && isMinimized) return null;

  const emptyStateLabel = t("analysis.chatEmptyState");
  const emptyStateHint = t("analysis.chatEmptyHint");
  const inputPlaceholder = isStreaming
    ? t("ai.generating")
    : hasActivePendingQuestion
      ? "Answer the question above first"
      : t("analysis.chatInputPlaceholder");
  const displayTitle = activeThreadTitle || t("analysis.title");

  return (
    <div
      ref={panelRef}
      className={cn(
        isDocked
          ? "flex h-full min-h-0 flex-col"
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
          <span className={cn("flex min-w-0 flex-col", isDocked ? "px-2" : "")}>
            <span
              className="max-w-[160px] truncate overflow-hidden text-ellipsis text-sm font-medium text-foreground"
              title={displayTitle}
            >
              {displayTitle}
            </span>
            {latestRun && (
              <span className="text-[10px] text-muted-foreground">
                Run {latestRun.status}
                {latestRun.activePhase ? ` · ${latestRun.activePhase}` : ""}
                {` · ${latestRun.progress.completed}/${latestRun.progress.total}`}
              </span>
            )}
          </span>
          {isStreaming && (
            <Loader2
              size={13}
              className="animate-spin text-muted-foreground ml-2"
            />
          )}
          <ConnectionIndicator />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void createThread()}
          disabled={isStreaming || isCreatingThread}
          title={t("ai.newChat")}
        >
          {isCreatingThread ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
        </Button>
      </div>

      {threads.length > 0 && (
        <div className="border-b border-border bg-card/80 px-2 py-2">
          <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => void selectThread(thread.id)}
                disabled={isLoadingThreads || isStreaming}
                className={cn(
                  "flex items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  thread.id === activeThreadId
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <span className="truncate">{thread.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- Messages --- */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-background/80 px-3.5 py-3",
          isDocked ? "rounded-xl" : "rounded-b-xl",
        )}
      >
        {threadError && (
          <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive/80">
            {threadError}
          </div>
        )}
        {/* Plan preview card (shown before analysis starts) */}
        {pendingPlan && (
          <PlanPreviewCardWrapper
            topic={pendingPlan.topic}
            model={model}
            availableModels={availableModels}
          />
        )}
        {messages.length === 0 && !pendingPlan ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="max-w-[240px] text-xs text-muted-foreground">
              {emptyStateLabel}
            </p>
            <p className="mt-3 max-w-[220px] text-[10px] text-muted-foreground/60">
              {emptyStateHint}
            </p>
          </div>
        ) : hasTranscript ? (
          /* Unified transcript — interleaves messages, activities, phase dividers */
          <>
            {transcript.map((entry) => {
              if (entry.kind === "message") {
                return (
                  <ChatMessage
                    key={entry.id}
                    role={entry.message.role}
                    content={entry.message.content}
                    isStreaming={false}
                    attachments={entry.message.attachments}
                  />
                );
              }
              if (entry.kind === "activity") {
                return (
                  <ActivityCard
                    key={entry.id}
                    kind={
                      entry.activityKind === "tool"
                        ? "tool-call"
                        : entry.activityKind === "web-search"
                          ? "web-search"
                          : "unknown"
                    }
                    message={entry.message}
                    status={entry.status}
                    toolName={entry.toolName}
                    query={entry.query}
                    timestamp={entry.timestamp}
                    isLive={entry.isLive}
                  />
                );
              }
              if (entry.kind === "phase-divider") {
                return (
                  <PhaseDivider
                    key={entry.id}
                    phaseNumber={entry.phaseNumber}
                    phaseName={entry.phaseName}
                    status={entry.status}
                  />
                );
              }
              return null;
            })}
            {/* Pending turn + notices render after transcript (streaming chat) */}
            {[
              ...notices,
              ...(pendingTurn ? projectPendingTurnToMessages(pendingTurn) : []),
            ].map((msg) =>
              isToolMessage(msg.id) ? (
                <ToolStatusMessage
                  key={msg.id}
                  content={msg.content}
                  status={resolveToolStatus(msg, isStreaming)}
                />
              ) : (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={msg.isStreaming && isStreaming}
                  attachments={msg.attachments}
                />
              ),
            )}
          </>
        ) : (
          messages.map((msg) =>
            isToolMessage(msg.id) ? (
              <ToolStatusMessage
                key={msg.id}
                content={msg.content}
                status={resolveToolStatus(msg, isStreaming)}
              />
            ) : (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming && isStreaming}
                attachments={msg.attachments}
              />
            ),
          )
        )}
        {/* Pending questions */}
        {pendingQuestions.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {pendingQuestions.map((pq, idx) => {
              if (idx > activeQuestionIndex) return null;
              const isPending =
                pq.status === "pending" && idx === activeQuestionIndex;
              const resolvedAnswer = pq.answer
                ? formatQuestionAnswer(pq)
                : undefined;
              return (
                <QuestionCard
                  key={pq.question.id}
                  question={pq.question}
                  questionIndex={idx}
                  totalQuestions={pendingQuestions.length}
                  isPending={isPending}
                  resolvedAnswer={resolvedAnswer}
                  onResolve={(questionId, answer) =>
                    resolveQuestion(questionId, answer)
                  }
                />
              );
            })}
          </div>
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
            onClick={() => {
              if (analysisRunning) {
                setNotices((prev) => [
                  ...prev,
                  {
                    id: `provider-blocked-${Date.now()}`,
                    role: "assistant",
                    content: i18n.t("analysis.cannotChangeModel"),
                    timestamp: Date.now(),
                  },
                ]);
                return;
              }
              setModelDropdownOpen((v) => !v);
            }}
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
              {isStreaming || analysisRunning ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleStop}
                  title={t("ai.stopGenerating")}
                  className="shrink-0 rounded-lg h-7 w-7 text-destructive hover:text-destructive hover:scale-110 active:scale-95 transition-all duration-150"
                >
                  <Square size={10} fill="currentColor" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleSend()}
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
