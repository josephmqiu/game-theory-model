import { useCallback, useEffect, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import TopBar from "./top-bar";
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
import { initAppStorage } from "@/utils/app-storage";
import { runMethodologyAnalysis } from "@/services/ai/methodology-orchestrator";
import type { OrchestratorCallbacks } from "@/services/ai/methodology-orchestrator";
import type { AnalysisEntity } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";
import { PanelRight, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditorLayout() {
  const isDirty = useEntityGraphStore((state) => state.isDirty);

  // ── Layout state ──
  const [phaseFilter, setPhaseFilter] = useState<MethodologyPhase | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<AnalysisEntity | null>(
    null,
  );
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 });
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // AbortController for orchestrator runs
  const abortRef = useRef<AbortController | null>(null);

  // ── Orchestrator start (called from chat panel) ──
  const startOrchestrator = useCallback((topic: string) => {
    // Abort any running orchestrator
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset analysis with the new topic
    useEntityGraphStore.getState().newAnalysis(topic);

    const callbacks: OrchestratorCallbacks = {
      onPhaseStart: (phase) => {
        // Chat panel listens to entity graph store phase status changes
        void phase;
      },
      onPhaseComplete: (phase, entityCount) => {
        void phase;
        void entityCount;
      },
      onPhaseFailed: (phase, error) => {
        console.error(`[orchestrator] Phase ${phase} failed:`, error);
      },
      onComplete: () => {
        // Analysis complete
      },
    };

    void runMethodologyAnalysis({
      topic,
      signal: controller.signal,
      callbacks,
    });
  }, []);

  // ── Cleanup orchestrator on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Agent settings shortcut (Cmd+,) ──
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

  useElectronMenu();

  // ── Hydrate app storage ──
  useEffect(() => {
    initAppStorage().then(() => {
      useAgentSettingsStore.getState().hydrate();
    });
  }, []);

  // ── Unsaved changes warning ──
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ── Search → highlight entities ──
  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchHighlight([]);
      return;
    }
    const normalized = query.toLowerCase();
    const entities = useEntityGraphStore.getState().analysis.entities;
    const matches = entities
      .filter((e) => {
        const d = e.data;
        const text =
          ("name" in d ? d.name : "") +
          ("content" in d ? d.content : "") +
          ("description" in d ? d.description : "") +
          ("action" in d ? d.action : "");
        return text.toLowerCase().includes(normalized);
      })
      .map((e) => e.id);
    setSearchHighlight(matches);
  }, []);

  // ── Entity selection from canvas click ──
  const handleEntitySelect = useCallback((entity: AnalysisEntity | null) => {
    setSelectedEntity(entity);
    if (entity) {
      // Place overlay card near the entity's screen position
      // Use a reasonable default position (right side of entity)
      setOverlayPosition({
        x: entity.position.x + 180,
        y: entity.position.y + 40,
      });
    }
  }, []);

  // ── Phase sidebar rerun ──
  const handleRerunPhase = useCallback(
    (_phase: MethodologyPhase) => {
      const topic = useEntityGraphStore.getState().analysis.topic;
      if (!topic) return;
      // For now, start the full orchestrator — individual phase rerun is future work
      startOrchestrator(topic);
    },
    [startOrchestrator],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar />

        <div className="flex min-h-0 flex-1">
          {/* Phase sidebar */}
          <PhaseSidebar
            onPhaseFilter={setPhaseFilter}
            onRerunPhase={handleRerunPhase}
            onSearch={handleSearch}
            activeFilter={phaseFilter}
          />

          {/* Main canvas area */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            <AnalysisCanvas
              onEntitySelect={handleEntitySelect}
              phaseFilter={phaseFilter}
              searchHighlight={searchHighlight}
            />

            {/* Phase progress bar (bottom overlay) */}
            <PhaseProgress className="absolute bottom-4 left-1/2 -translate-x-1/2" />

            {/* Entity overlay card */}
            {selectedEntity && (
              <EntityOverlayCard
                entity={selectedEntity}
                screenPosition={overlayPosition}
                onEdit={() => {
                  // Future: open inline edit mode
                }}
                onChallenge={() => {
                  // Future: send challenge to chat
                }}
                onClose={() => setSelectedEntity(null)}
              />
            )}
          </div>

          {/* Chat panel (collapsible) */}
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
