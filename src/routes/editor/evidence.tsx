import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";

export const Route = createFileRoute("/editor/evidence")({
  component: EvidencePage,
});

function EvidencePage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const sources = Object.values(canonical.sources);
  const observations = Object.values(canonical.observations);
  const claims = Object.values(canonical.claims);
  const inferences = Object.values(canonical.inferences);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Evidence</h2>
      <p className="text-muted-foreground mb-6">
        Sources, observations, claims, and inferences in the canonical model.
      </p>

      <div className="space-y-6">
        <EvidenceSection title="Sources" items={sources} />
        <EvidenceSection title="Observations" items={observations} />
        <EvidenceSection title="Claims" items={claims} />
        <EvidenceSection title="Inferences" items={inferences} />
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; description?: string; content?: string }>;
}) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {title} (0)
        </h3>
        <p className="text-sm text-muted-foreground italic">None yet</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title} ({items.length})
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded border border-border bg-card p-3"
          >
            <p className="text-sm font-mono text-muted-foreground mb-1">
              {item.id}
            </p>
            <p className="text-sm">
              {item.description ?? item.content ?? "No description"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
