import { createFileRoute } from "@tanstack/react-router";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useConversationStore } from "@/stores/conversation-store";
import { PHASE_NAMES } from "@/constants/phases";

export const Route = createFileRoute("/editor/phase/$phaseId")({
  component: PhaseDetailPage,
});

function PhaseDetailPage() {
  const { phaseId } = Route.useParams();
  const phase = parseInt(phaseId, 10);
  const phaseName = PHASE_NAMES[phase] ?? `Phase ${phase}`;

  const analysisState = usePipelineStore((s) => s.analysis_state);
  const phaseState = analysisState?.phase_states?.[phase];
  // TODO: use phaseResults to display detailed results
  // const phaseResults = usePipelineStore((s) => s.phase_results[phase]);

  const messages = useConversationStore((s) =>
    s.messages.filter((m) => m.phase === phase),
  );

  const proposals = useConversationStore((s) => {
    const groups = s.messages
      .filter((m) => m.phase === phase)
      .flatMap((m) => m.structured_content?.proposals ?? []);
    return groups;
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-mono font-bold">
          {phase}
        </span>
        <div>
          <h2 className="text-2xl font-bold">{phaseName}</h2>
          <p className="text-sm text-muted-foreground">
            {phaseState?.status
              ? `Status: ${phaseState.status}`
              : "Not started"}
          </p>
        </div>
      </div>

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Proposals ({proposals.length})
          </h3>
          <div className="space-y-3">
            {proposals.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      group.status === "accepted"
                        ? "bg-green-500/10 text-green-500"
                        : group.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : group.status === "rejected"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {group.status}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.proposals.map((p) => (
                    <div key={p.id} className="text-sm flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.status === "accepted"
                            ? "bg-green-500"
                            : p.status === "pending"
                              ? "bg-yellow-500"
                              : p.status === "rejected"
                                ? "bg-red-500"
                                : "bg-muted-foreground"
                        }`}
                      />
                      {p.description}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase messages */}
      {messages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Messages ({messages.length})
          </h3>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${msg.role === "ai" ? "text-primary" : "text-foreground"}`}
                  >
                    {msg.role === "ai" ? "AI" : "User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {msg.message_type && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {msg.message_type}
                    </span>
                  )}
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!phaseState && proposals.length === 0 && messages.length === 0 && (
        <p className="text-muted-foreground italic">
          This phase has not been executed yet.
        </p>
      )}
    </div>
  );
}
