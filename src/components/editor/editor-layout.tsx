import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { PanelRight, PanelRightClose } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import TopBar from "./top-bar";
import { abortAnalysisRun, type ActiveAnalysisRun } from "./analysis-run";
import AgentSettingsDialog from "@/components/shared/agent-settings-dialog";
import UpdateReadyBanner from "./update-ready-banner";
import AnalysisCanvas from "./analysis-canvas";
import AIChatPanel from "@/components/panels/ai-chat-panel";
import { PhaseSidebar } from "@/components/panels/phase-sidebar";
import { PhaseProgress } from "@/components/panels/phase-progress";
import EntityOverlayCard from "@/components/panels/entity-overlay-card";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { initAppStorage } from "@/utils/app-storage";
import { createRunLogger } from "@/services/ai/ai-logger";
import {
  runMethodologyAnalysis,
  type OrchestratorCallbacks,
} from "@/services/ai/methodology-orchestrator";
import {
  openAnalysis,
  openAnalysisFromPath,
} from "@/services/analysis/analysis-persistence";
import type { AnalysisEntity } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";

export default function EditorLayout() {
  const isDirty = useEntityGraphStore((state) => state.isDirty);
  const activeRunRef = useRef<ActiveAnalysisRun | null>(null);

  const [phaseFilter, setPhaseFilter] = useState<MethodologyPhase | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<AnalysisEntity | null>(
    null,
  );
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 });
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const clearEditorChrome = useCallback(() => {
    setPhaseFilter(null);
    setSearchHighlight([]);
    setSelectedEntity(null);
  }, []);

  const abortActiveRun = useCallback(async (reason: string) => {
    const activeRun = activeRunRef.current;
    if (!activeRun) {
      return;
    }

    await abortAnalysisRun(activeRun, reason);

    if (activeRunRef.current?.runId === activeRun.runId) {
      activeRunRef.current = null;
    }
  }, []);

  const handleOpenAnalysis = useCallback(
    async (filePath?: string) => {
      await abortActiveRun("open-analysis");
      const opened = filePath
        ? await openAnalysisFromPath(filePath)
        : await openAnalysis();

      if (!opened) {
        return;
      }

      clearEditorChrome();
    },
    [abortActiveRun, clearEditorChrome],
  );

  const handleNewAnalysis = useCallback(async () => {
    const state = useEntityGraphStore.getState();
    if (state.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved analysis changes. Discard them and start a new analysis?",
      );
      if (!confirmed) {
        return;
      }
    }

    await abortActiveRun("new-analysis");
    clearEditorChrome();
    useEntityGraphStore.getState().newAnalysis("");
  }, [abortActiveRun, clearEditorChrome]);

  const startOrchestrator = useCallback(
    (topic: string) => {
      void (async () => {
        await abortActiveRun("restart-analysis");
        clearEditorChrome();
        useEntityGraphStore.getState().newAnalysis(topic);

        const controller = new AbortController();
        const runId = nanoid(8);
        const logger = createRunLogger(runId);
        const run = { runId, logger };

        const callbacks: OrchestratorCallbacks = {
          onPhaseStart: (phase) => {
            logger.log("ui", "phase-start", { phase });
          },
          onPhaseComplete: (phase, entityCount) => {
            logger.log("ui", "phase-complete", { phase, entityCount });
          },
          onPhaseFailed: (phase, error) => {
            logger.error("ui", "phase-failed", { phase, error });
          },
        };

        const promise = runMethodologyAnalysis({
          topic,
          signal: controller.signal,
          callbacks,
          run,
        });

        activeRunRef.current = {
          controller,
          promise,
          runId,
          logger,
        };

        try {
          await promise;
        } finally {
          if (activeRunRef.current?.runId === runId) {
            activeRunRef.current = null;
          }
        }
      })();
    },
    [abortActiveRun, clearEditorChrome],
  );

  useEffect(() => {
    return () => {
      void abortActiveRun("component-unmount");
    };
  }, [abortActiveRun]);

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
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      void activeRunRef.current?.logger.flush({ transport: "beacon" });

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
    setSelectedEntity(entity);
    if (!entity) {
      return;
    }

    setOverlayPosition({
      x: entity.position.x + 180,
      y: entity.position.y + 40,
    });
  }, []);

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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar
          onNewAnalysis={handleNewAnalysis}
          onOpenAnalysis={() => handleOpenAnalysis()}
        />

        <div className="flex min-h-0 flex-1">
          <PhaseSidebar
            onPhaseFilter={setPhaseFilter}
            onRerunPhase={handleRerunPhase}
            onSearch={handleSearch}
            activeFilter={phaseFilter}
          />

          <div className="relative flex min-w-0 flex-1 flex-col">
            <AnalysisCanvas
              onEntitySelect={handleEntitySelect}
              phaseFilter={phaseFilter}
              searchHighlight={searchHighlight}
            />

            <PhaseProgress className="absolute bottom-4 left-1/2 -translate-x-1/2" />

            {selectedEntity && (
              <EntityOverlayCard
                entity={selectedEntity}
                screenPosition={overlayPosition}
                onEdit={() => {}}
                onChallenge={() => {}}
                onClose={() => setSelectedEntity(null)}
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
            <div className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
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
                <AIChatPanel
                  mode="analysis"
                  presentation="docked"
                  onStartAnalysis={startOrchestrator}
                />
              </div>
            </div>
          )}
        </div>

        <AgentSettingsDialog />
      </div>
    </TooltipProvider>
  );
}
