import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { analysisStore, useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";

export const Route = createFileRoute("/editor/assumptions")({
  component: AssumptionsPage,
});

function AssumptionsPage() {
  const manualMode = useUiStore((s) => s.manualMode);
  const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);
  const assumptionsRecord = useAnalysisStore((s) => s.canonical.assumptions);
  const assumptions = useMemo(
    () => Object.values(assumptionsRecord),
    [assumptionsRecord],
  );
  const [editingAssumptionId, setEditingAssumptionId] = useState<string | null>(
    null,
  );
  const [draftStatement, setDraftStatement] = useState("");
  const [draftType, setDraftType] = useState<
    | "behavioral"
    | "capability"
    | "structural"
    | "institutional"
    | "rationality"
    | "information"
  >("behavioral");
  const [draftSensitivity, setDraftSensitivity] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [draftConfidence, setDraftConfidence] = useState("0.7");
  const [error, setError] = useState<string | null>(null);

  function beginEdit(assumptionId: string): void {
    const assumption = assumptions.find((entry) => entry.id === assumptionId);
    if (!assumption) return;
    setEditingAssumptionId(assumptionId);
    setDraftStatement(assumption.statement);
    setDraftType(assumption.type);
    setDraftSensitivity(assumption.sensitivity);
    setDraftConfidence(String(assumption.confidence));
    setError(null);
  }

  function saveEdit(): void {
    if (!editingAssumptionId || !draftStatement.trim()) return;

    const result = analysisStore.getState().dispatch({
      kind: "update_assumption",
      payload: {
        id: editingAssumptionId,
        statement: draftStatement.trim(),
        type: draftType,
        sensitivity: draftSensitivity,
        confidence: Number(draftConfidence) || 0.7,
      },
    });

    if (result.status !== "committed") {
      setError(
        result.status === "rejected"
          ? result.errors.join(", ") || "Could not update assumption."
          : "Could not update assumption.",
      );
      return;
    }

    setEditingAssumptionId(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Assumptions</h2>
        <p className="text-muted-foreground">
          Extracted assumptions, their types, and sensitivity ratings from the
          current model.
        </p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {assumptions.length === 0 ? (
        <p className="italic text-muted-foreground">
          No assumptions extracted yet. Run Phase 7 to populate this view.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assumptions.map((assumption) => (
            <article
              key={assumption.id}
              role="button"
              tabIndex={0}
              className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() =>
                setInspectedTarget({
                  entityType: "assumption",
                  entityId: assumption.id,
                })
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                setInspectedTarget({
                  entityType: "assumption",
                  entityId: assumption.id,
                });
              }}
            >
              {editingAssumptionId === assumption.id ? (
                <div className="space-y-3">
                  <textarea
                    value={draftStatement}
                    onChange={(event) => setDraftStatement(event.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      value={draftType}
                      onChange={(event) =>
                        setDraftType(event.target.value as typeof draftType)
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="behavioral">Behavioral</option>
                      <option value="capability">Capability</option>
                      <option value="structural">Structural</option>
                      <option value="institutional">Institutional</option>
                      <option value="rationality">Rationality</option>
                      <option value="information">Information</option>
                    </select>
                    <select
                      value={draftSensitivity}
                      onChange={(event) =>
                        setDraftSensitivity(
                          event.target.value as typeof draftSensitivity,
                        )
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input
                      value={draftConfidence}
                      onChange={(event) =>
                        setDraftConfidence(event.target.value)
                      }
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAssumptionId(null)}
                      className="rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      {assumption.statement}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {assumption.sensitivity}
                      </span>
                      {manualMode && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEdit(assumption.id);
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {assumption.type}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Confidence {(assumption.confidence * 100).toFixed(0)}% ·
                    {assumption.game_theoretic_vs_empirical ?? "mixed signal"}
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
