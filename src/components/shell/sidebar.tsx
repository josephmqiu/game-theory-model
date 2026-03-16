/**
 * Sidebar — navigation + phase status.
 */

import {
  BarChart3,
  FileText,
  Users,
  Target,
  Clock,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { Link } from "@tanstack/react-router";
import { PHASES } from "@/constants/phases";

const NAV_ITEMS = [
  {
    icon: BarChart3,
    label: "Overview",
    id: "overview" as const,
    to: "/editor",
  },
  {
    icon: FileText,
    label: "Evidence",
    id: "evidence" as const,
    to: "/editor/evidence",
  },
  {
    icon: Users,
    label: "Players",
    id: "players" as const,
    to: "/editor/players",
  },
  {
    icon: Target,
    label: "Scenarios",
    id: "scenarios" as const,
    to: "/editor/scenarios",
  },
  {
    icon: Clock,
    label: "Timeline",
    id: "timeline" as const,
    to: "/editor/timeline",
  },
] as const;

function PhaseStatusIcon({ phase }: { phase: number }) {
  const analysisState = usePipelineStore((s) => s.analysis_state);
  const phaseStates = analysisState?.phase_states ?? {};
  const phaseState = phaseStates[phase];

  if (!phaseState) {
    return (
      <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-mono">
        {phase}
      </span>
    );
  }

  switch (phaseState.status) {
    case "complete":
      return <CheckCircle2 size={16} className="text-green-500" />;
    case "running":
      return <Loader2 size={16} className="text-blue-500 animate-spin" />;
    case "review_needed":
      return <Circle size={16} className="text-yellow-500" />;
    default:
      return (
        <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-mono">
          {phase}
        </span>
      );
  }
}

export function Sidebar() {
  const activePanel = useUiStore((s) => s.activePanel);
  const activePhase = useUiStore((s) => s.activePhase);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const setActivePhase = useUiStore((s) => s.setActivePhase);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  if (collapsed) {
    return null;
  }

  return (
    <aside className="w-56 border-r border-border flex flex-col shrink-0 overflow-y-auto">
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, id, to }) => (
          <Link
            key={id}
            to={to}
            onClick={() => {
              setActivePanel(id);
              setActivePhase(null);
            }}
            className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
              activePanel === id && activePhase === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 mt-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">
          Phases
        </h3>
        <div className="space-y-0.5">
          {PHASES.map(({ id, label }) => (
            <Link
              key={id}
              to="/editor/phase/$phaseId"
              params={{ phaseId: String(id) }}
              onClick={() => {
                setActivePhase(id);
                setActivePanel("overview");
              }}
              className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                activePhase === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <PhaseStatusIcon phase={id} />
              {label}
              <ChevronRight size={14} className="ml-auto opacity-50" />
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
