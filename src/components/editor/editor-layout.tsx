import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import TopBar from "./top-bar";
import AgentSettingsDialog from "@/components/shared/agent-settings-dialog";
import UpdateReadyBanner from "./update-ready-banner";
import AnalysisPanel from "@/components/panels/analysis-panel";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { initAppStorage } from "@/utils/app-storage";

export default function EditorLayout() {
  const isDirty = useAnalysisStore((state) => state.isDirty);

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

  useEffect(() => {
    initAppStorage().then(() => {
      useAgentSettingsStore.getState().hydrate();
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 p-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Manual Analysis
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                Build a complete two-player analysis manually. Create a new
                analysis or open an existing `.gta` file to continue working
                without AI.
              </p>
            </section>

            <AnalysisPanel />
          </div>
        </div>
        <AgentSettingsDialog />
      </div>
    </TooltipProvider>
  );
}
