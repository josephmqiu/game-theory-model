/**
 * Recovery view — shown when a .gta.json file fails to load.
 * Displays the error stage, message, and issues.
 * Allows editing raw JSON and retrying, or starting fresh.
 */

import { useCallback, useState } from "react";
import { AlertTriangle, RefreshCw, FilePlus } from "lucide-react";
import { useRecoveryStore, recoveryStore } from "@/stores/recovery-store";
import { loadFileFromContent } from "@/hooks/file-operations";

const STAGE_LABELS: Record<string, string> = {
  parse: "JSON Parse Error",
  migration: "Schema Migration Failed",
  validation: "Validation Failed",
  structural: "Structural Integrity Error",
};

export function RecoveryView() {
  const stage = useRecoveryStore((s) => s.stage);
  const error = useRecoveryStore((s) => s.error);
  const rawContent = useRecoveryStore((s) => s.rawContent);
  const filePath = useRecoveryStore((s) => s.filePath);
  const [editedContent, setEditedContent] = useState(rawContent ?? "");
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!editedContent.trim()) return;
    setRetrying(true);
    try {
      recoveryStore.getState().clearRecovery();
      await loadFileFromContent(filePath ?? "recovery.gta.json", editedContent);
    } catch {
      // loadFileFromContent will re-enter recovery if it fails again
    } finally {
      setRetrying(false);
    }
  }, [editedContent, filePath]);

  const handleStartFresh = useCallback(() => {
    recoveryStore.getState().clearRecovery();
  }, []);

  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Recovery Mode</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The analysis file could not be loaded. You can edit the raw JSON
              and retry, or start a fresh analysis.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">Stage:</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
              {stage ? (STAGE_LABELS[stage] ?? stage) : "Unknown"}
            </span>
          </div>

          {error?.message && (
            <div>
              <p className="text-sm font-medium text-foreground">Error</p>
              <p className="mt-1 text-sm text-red-500">{error.message}</p>
            </div>
          )}

          {error?.issues && error.issues.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Issues</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border bg-background p-2 text-xs text-muted-foreground">
                {error.issues.join("\n")}
              </pre>
            </div>
          )}

          {filePath && (
            <p className="break-all text-xs text-muted-foreground">
              File: {filePath}
            </p>
          )}
        </div>

        {rawContent !== null && (
          <div>
            <label
              htmlFor="recovery-editor"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Raw JSON
            </label>
            <textarea
              id="recovery-editor"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="h-48 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              spellCheck={false}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying || !editedContent.trim()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`}
            />
            {retrying ? "Retrying..." : "Retry Load"}
          </button>
          <button
            type="button"
            onClick={handleStartFresh}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <FilePlus className="h-4 w-4" />
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}
