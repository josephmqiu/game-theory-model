import { useEffect } from "react";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  saveEntityAnalysis,
  saveEntityAnalysisAs,
  openEntityAnalysis,
} from "@/services/analysis/analysis-persistence";

/**
 * Listens for Electron native menu actions and dispatches them into the
 * entity graph persistence controller used by the live workspace.
 */
export function useElectronMenu() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handleMenuAction = async (action: string) => {
      if (action === "new") {
        const state = useEntityGraphStore.getState();
        if (state.isDirty) {
          const confirmed = window.confirm(
            "You have unsaved analysis changes. Discard them and start a new analysis?",
          );
          if (!confirmed) return;
        }
        useEntityGraphStore.getState().newAnalysis("");
        return;
      }

      if (action === "open") {
        await openEntityAnalysis();
        return;
      }

      if (action === "save") {
        await saveEntityAnalysis();
        return;
      }

      if (action === "saveAs") {
        await saveEntityAnalysisAs();
      }
    };

    const disposeMenu =
      api.onMenuAction?.((action: string) => {
        void handleMenuAction(action);
      }) ?? null;

    const disposeOpenFile =
      api.onOpenFile?.((_filePath: string) => {
        // Entity graph file opening from OS-level file association
        // For now, delegate to the entity analysis opener
        void openEntityAnalysis();
      }) ?? null;

    void api.getPendingFile?.().then((_filePath) => {
      if (_filePath) {
        void openEntityAnalysis();
      }
    });

    return () => {
      disposeMenu?.();
      disposeOpenFile?.();
    };
  }, []);
}
