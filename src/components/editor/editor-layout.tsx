import { useCallback, useEffect, useRef, useState } from "react";
import {
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import TopBar from "./top-bar";
import AgentSettingsDialog from "@/components/shared/agent-settings-dialog";
import UpdateReadyBanner from "./update-ready-banner";
import AnalysisCanvas from "./analysis-canvas";
import AnalysisLauncher from "./analysis-launcher";
import AIChatPanel from "@/components/panels/ai-chat-panel";
import { PhaseSidebar } from "@/components/panels/phase-sidebar";
import { PhaseProgress } from "@/components/panels/phase-progress";
import EntityOverlayCard from "@/components/panels/entity-overlay-card";
import {
  buildAnalysisRuntimeOverrides,
  useAgentSettingsStore,
} from "@/stores/agent-settings-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { initAppStorage } from "@/utils/app-storage";
import * as analysisClient from "@/services/ai/analysis-client";
import {
  openAnalysis,
  openAnalysisFromPath,
} from "@/services/analysis/analysis-persistence";
import { sceneToScreen } from "@/canvas/skia/skia-viewport";
import { getEntityCardMetrics } from "@/services/entity/entity-card-metrics";
import type { AnalysisEntity } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";

// ── Vertical resize handle ──

function ResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const lastX = useRef<number | null>(null);

  return (
    <div
      className="group relative w-1 shrink-0 cursor-col-resize select-none"
      onPointerDown={(e) => {
        lastX.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (lastX.current === null) return;
        const delta = e.clientX - lastX.current;
        lastX.current = e.clientX;
        onDrag(delta);
      }}
      onPointerUp={(e) => {
        lastX.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    >
      <div className="absolute inset-y-0 -left-px w-[3px] transition-colors group-hover:bg-primary/30 group-active:bg-primary/50" />
    </div>
  );
}

export default function EditorLayout() {
  const { t } = useTranslation();
  const isDirty = useEntityGraphStore((state) => state.isDirty);

  const [phaseFilter, setPhaseFilter] = useState<MethodologyPhase | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<string[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const selectedEntity = useEntityGraphStore((state) =>
    selectedEntityId
      ? (state.analysis.entities.find((e) => e.id === selectedEntityId) ?? null)
      : null,
  );
  const layout = useEntityGraphStore((state) => state.layout);
  const viewport = useCanvasStore((state) => state.viewport);
  const analysisTopic = useEntityGraphStore((state) => state.analysis.topic);
  const entityCount = useEntityGraphStore(
    (state) => state.analysis.entities.length,
  );
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [chatWidth, setChatWidth] = useState(320);
  const canvasSurfaceRef = useRef<HTMLDivElement>(null);

  const clearEditorChrome = useCallback(() => {
    setPhaseFilter(null);
    setSearchHighlight([]);
    setSelectedEntityId(null);
  }, []);

  const handleOpenAnalysis = useCallback(
    async (filePath?: string) => {
      analysisClient.abort();
      const opened = filePath
        ? await openAnalysisFromPath(filePath)
        : await openAnalysis();

      if (!opened) {
        return;
      }

      clearEditorChrome();
    },
    [clearEditorChrome],
  );

  const handleNewAnalysis = useCallback(() => {
    const state = useEntityGraphStore.getState();
    if (state.isDirty) {
      const confirmed = window.confirm(t("analysis.unsavedChanges"));
      if (!confirmed) {
        return;
      }
    }

    analysisClient.abort();
    clearEditorChrome();
    useEntityGraphStore.getState().newAnalysis("");
  }, [clearEditorChrome, t]);

  const startOrchestrator = useCallback(
    (topic: string, provider?: string, model?: string) => {
      void (async () => {
        // Abort any existing run via the client (manages its own AbortController)
        analysisClient.abort();
        clearEditorChrome();
        useEntityGraphStore.getState().newAnalysis(topic);
        const runtime = buildAnalysisRuntimeOverrides(
          useAgentSettingsStore.getState(),
        );

        try {
          await analysisClient.startAnalysis(topic, provider, model, runtime);
        } catch (err) {
          console.error(
            "[editor] analysis-start-failed",
            err instanceof Error ? err.message : String(err),
          );
        }
      })();
    },
    [clearEditorChrome],
  );

  useEffect(() => {
    return () => {
      analysisClient.abort();
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.key !== ",") {
        return;
      }
      event.preventDefault();
      useAgentSettingsStore.getState().setDialogOpen(true);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useElectronMenu({
    onNewAnalysis: handleNewAnalysis,
    onOpenAnalysis: handleOpenAnalysis,
  });
  useKeyboardShortcuts({
    onNewAnalysis: handleNewAnalysis,
    onOpenAnalysis: () => handleOpenAnalysis(),
  });

  useEffect(() => {
    void initAppStorage().then(() => {
      useAgentSettingsStore.getState().hydrate();
      void analysisClient.hydrateAnalysisState({
        enableRecoveryPolling: true,
      });
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Abort any running analysis on page unload
      analysisClient.abort();

      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchHighlight([]);
      return;
    }

    const normalized = query.toLowerCase();
    const entities = useEntityGraphStore.getState().analysis.entities;
    const matches = entities
      .filter((entity) => {
        const data = entity.data;
        const text =
          ("name" in data ? data.name : "") +
          ("content" in data ? data.content : "") +
          ("description" in data ? data.description : "") +
          ("action" in data ? data.action : "");
        return text.toLowerCase().includes(normalized);
      })
      .map((entity) => entity.id);
    setSearchHighlight(matches);
  }, []);

  const handleEntitySelect = useCallback((entity: AnalysisEntity | null) => {
    setSelectedEntityId(entity?.id ?? null);
  }, []);

  const selectedEntityScreenPosition =
    selectedEntity && canvasSurfaceRef.current
      ? (() => {
          const layoutEntry = layout[selectedEntity.id];
          if (!layoutEntry) {
            return null;
          }

          const metrics = getEntityCardMetrics(selectedEntity.type);
          const rect = canvasSurfaceRef.current.getBoundingClientRect();
          return sceneToScreen(
            layoutEntry.x + metrics.width,
            layoutEntry.y + Math.min(16, metrics.height / 2),
            rect,
            viewport,
          );
        })()
      : null;

  const handleRerunPhase = useCallback(
    (_phase: MethodologyPhase) => {
      const topic = useEntityGraphStore.getState().analysis.topic;
      if (!topic) {
        return;
      }

      startOrchestrator(topic);
    },
    [startOrchestrator],
  );

  const showAnalysisLauncher =
    analysisTopic.trim().length === 0 && entityCount === 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar
          onNewAnalysis={handleNewAnalysis}
          onOpenAnalysis={() => handleOpenAnalysis()}
        />

        <div className="flex min-h-0 flex-1">
          {sidebarCollapsed ? (
            <div className="flex w-10 flex-col items-center border-r border-zinc-700 bg-zinc-900 pt-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarCollapsed(false)}
                className="text-muted-foreground"
              >
                <PanelLeft size={16} />
              </Button>
            </div>
          ) : (
            <>
              <div
                className="flex shrink-0 flex-col border-r border-zinc-700 bg-zinc-900"
                style={{ width: sidebarWidth }}
              >
                <div className="flex items-center justify-end border-b border-zinc-700 px-1 py-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSidebarCollapsed(true)}
                    className="text-muted-foreground"
                  >
                    <PanelLeftClose size={16} />
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <PhaseSidebar
                    onPhaseFilter={setPhaseFilter}
                    onRerunPhase={handleRerunPhase}
                    onSearch={handleSearch}
                    activeFilter={phaseFilter}
                  />
                </div>
              </div>
              <ResizeHandle
                onDrag={(delta) =>
                  setSidebarWidth((w) =>
                    Math.min(400, Math.max(140, w + delta)),
                  )
                }
              />
            </>
          )}

          <div
            ref={canvasSurfaceRef}
            className="relative flex min-w-0 flex-1 flex-col"
          >
            <AnalysisCanvas
              onEntitySelect={handleEntitySelect}
              phaseFilter={phaseFilter}
              searchHighlight={searchHighlight}
            />

            {showAnalysisLauncher && (
              <AnalysisLauncher onStartAnalysis={startOrchestrator} />
            )}

            <PhaseProgress className="absolute bottom-4 left-1/2 -translate-x-1/2" />

            {selectedEntity && selectedEntityScreenPosition && (
              <EntityOverlayCard
                entity={selectedEntity}
                screenPosition={selectedEntityScreenPosition}
                onEdit={() => {}}
                onChallenge={() => {}}
                onClose={() => setSelectedEntityId(null)}
              />
            )}
          </div>

          {chatCollapsed ? (
            <div className="flex w-10 flex-col items-center border-l border-border bg-card pt-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatCollapsed(false)}
                className="text-muted-foreground"
              >
                <PanelRight size={16} />
              </Button>
            </div>
          ) : (
            <>
              <ResizeHandle
                onDrag={(delta) =>
                  setChatWidth((w) => Math.min(500, Math.max(240, w - delta)))
                }
              />
              <div
                className="flex shrink-0 flex-col border-l border-border bg-card"
                style={{ width: chatWidth }}
              >
                <div className="flex items-center justify-end border-b border-border px-1 py-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setChatCollapsed(true)}
                    className="text-muted-foreground"
                  >
                    <PanelRightClose size={16} />
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <AIChatPanel mode="analysis" presentation="docked" />
                </div>
              </div>
            </>
          )}
        </div>

        <AgentSettingsDialog />
      </div>
    </TooltipProvider>
  );
}
