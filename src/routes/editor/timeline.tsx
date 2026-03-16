import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";

export const Route = createFileRoute("/editor/timeline")({
  component: TimelinePage,
});

function TimelinePage() {
  const eventLog = useAnalysisStore((s) => s.eventLog);
  const events = eventLog.events.slice(0, eventLog.cursor);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Timeline</h2>
      <p className="text-muted-foreground mb-6">
        Chronological history of model changes.
      </p>

      {events.length === 0 ? (
        <p className="text-muted-foreground italic">No events recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {[...events].reverse().map((event, idx) => (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded border border-border bg-card p-3"
            >
              <span className="text-xs font-mono text-muted-foreground w-8 shrink-0 text-right">
                #{events.length - idx}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {event.command.kind}
                  {event.command.kind === "batch"
                    ? ` (${event.command.label})`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()} ·{" "}
                  {event.source}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
