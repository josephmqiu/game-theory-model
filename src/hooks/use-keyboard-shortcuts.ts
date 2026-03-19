import { useEffect } from "react";
import { saveAnalysis } from "@/services/analysis/analysis-persistence";

interface KeyboardShortcutOptions {
  onNewAnalysis: () => void | Promise<void>;
  onOpenAnalysis: () => void | Promise<void>;
}

export function useKeyboardShortcuts({
  onNewAnalysis,
  onOpenAnalysis,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void onNewAnalysis();
        return;
      }

      if (isMod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveAnalysis();
        return;
      }

      if (isMod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void onOpenAnalysis();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewAnalysis, onOpenAnalysis]);
}
