import { analysisStore } from "@/stores/analysis-store";
import type { Command } from "shared/game-theory/engine/commands";

export type ManualEntityType =
  | "game"
  | "formalization"
  | "player"
  | "source"
  | "observation"
  | "claim"
  | "inference"
  | "assumption"
  | "scenario";

export type SourceKind =
  | "web"
  | "pdf"
  | "article"
  | "report"
  | "transcript"
  | "manual";
export type SourceQuality = "low" | "medium" | "high";

export function assertCommitted(command: Command): void {
  const result = analysisStore.getState().dispatch(command);
  if (result.status !== "committed") {
    const message =
      result.status === "rejected"
        ? result.errors.join(", ") || `Failed to apply ${command.kind}.`
        : `Failed to apply ${command.kind}.`;
    throw new Error(message);
  }
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function toggleStringValue(
  current: string[],
  value: string,
  checked: boolean,
): string[] {
  return checked
    ? [...new Set([...current, value])]
    : current.filter((entry) => entry !== value);
}

export type RunFn = (action: () => void, successMessage: string) => void;

// ---------------------------------------------------------------------------
// Shared prop shapes used by all builder sub-components
// ---------------------------------------------------------------------------

export interface BuilderProps {
  readonly run: RunFn;
}

export interface BuilderWithCanonicalProps extends BuilderProps {
  readonly canonical: import("shared/game-theory/types/canonical").CanonicalStore;
}
