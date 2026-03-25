import { useEffect } from "react";
import {
  saveAnalysis,
  saveAnalysisAs,
} from "@/services/analysis/analysis-persistence";

interface ElectronMenuOptions {
  onNewAnalysis: () => void | Promise<void>;
  onOpenAnalysis: (filePath?: string) => void | Promise<void>;
}

/**
 * Listens for Electron native menu actions and dispatches them into the
 * entity graph persistence controller used by the live workspace.
 */
export function useElectronMenu({
  onNewAnalysis,
  onOpenAnalysis,
}: ElectronMenuOptions) {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handleMenuAction = async (action: string) => {
      if (action === "new") {
        await onNewAnalysis();
        return;
      }

      if (action === "open") {
        await onOpenAnalysis();
        return;
      }

      if (action === "save") {
        await saveAnalysis();
        return;
      }

      if (action === "saveAs") {
        await saveAnalysisAs();
      }
    };

    const disposeMenu =
      api.onMenuAction?.((action: string) => {
        void handleMenuAction(action);
      }) ?? null;

    const disposeOpenFile =
      api.onOpenFile?.((filePath: string) => {
        void onOpenAnalysis(filePath);
      }) ?? null;

    void api.getPendingFile?.().then((filePath) => {
      if (filePath) {
        void onOpenAnalysis(filePath);
      }
    });

    return () => {
      disposeMenu?.();
      disposeOpenFile?.();
    };
  }, [onNewAnalysis, onOpenAnalysis]);
}
