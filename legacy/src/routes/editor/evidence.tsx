import { createFileRoute } from "@tanstack/react-router";
import { EvidenceNotebook } from "@/components/evidence/evidence-notebook";

export const Route = createFileRoute("/editor/evidence")({
  component: EvidencePage,
});

function EvidencePage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Evidence</h2>
      <p className="text-muted-foreground mb-6">
        Sources, observations, claims, and inferences in the canonical model.
      </p>
      <EvidenceNotebook />
    </div>
  );
}
