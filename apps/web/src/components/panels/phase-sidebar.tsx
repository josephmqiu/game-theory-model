import { useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  getRunFailureLabel,
  useRunStatusStore,
} from "@/stores/run-status-store";
import type { MethodologyPhase } from "@/types/methodology";
import { V3_PHASES, getRunnablePhaseNumber } from "@/types/methodology";

// ── Props ──

export interface PhaseSidebarProps {
  onPhaseFilter: (phase: MethodologyPhase | null) => void;
  onRerunPhase: (phase: MethodologyPhase) => void;
  onSearch: (query: string) => void;
  activeFilter: MethodologyPhase | null;
}

// ── Helpers ──

const PHASE_I18N_KEYS: Record<MethodologyPhase, string> = {
  "situational-grounding": "analysis.phases.situationalGrounding",
  "player-identification": "analysis.phases.playerIdentification",
  "baseline-model": "analysis.phases.baselineModel",
  "historical-game": "analysis.phases.historicalGame",
  revalidation: "analysis.phases.revalidation",
  "formal-modeling": "analysis.phases.formalModeling",
  assumptions: "analysis.phases.assumptions",
  elimination: "analysis.phases.elimination",
  scenarios: "analysis.phases.scenarios",
  "meta-check": "analysis.phases.metaCheck",
};

// ── Component ──

export function PhaseSidebar({
  onPhaseFilter,
  onRerunPhase,
  onSearch,
  activeFilter,
}: PhaseSidebarProps) {
  const { t } = useTranslation();
  const phases = useEntityGraphStore((s) => s.analysis.phases);
  const entities = useEntityGraphStore((s) => s.analysis.entities);
  const runStatus = useRunStatusStore((s) => s.runStatus);
  const [hoveredPhase, setHoveredPhase] = useState<MethodologyPhase | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  function getEntityCount(phase: MethodologyPhase): number {
    return entities.filter((e) => e.phase === phase).length;
  }

  function getPhaseState(phase: MethodologyPhase) {
    return phases.find((ps) => ps.phase === phase);
  }

  function handlePhaseClick(phase: MethodologyPhase) {
    // Toggle: clicking active filter clears it
    onPhaseFilter(activeFilter === phase ? null : phase);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    onSearch(value);
  }

  return (
    <aside className="flex h-full w-full flex-col">
      {/* Phase list */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {V3_PHASES.map((phase) => {
            const phaseState = getPhaseState(phase);
            const status = phaseState?.status ?? "pending";
            const entityCount = getEntityCount(phase);
            const isActive = activeFilter === phase;
            const isHovered = hoveredPhase === phase;
            const isRunning = status === "running";
            const failureLabel =
              status === "failed" &&
              runStatus.status === "failed" &&
              runStatus.failedPhase === phase &&
              runStatus.failureKind
                ? getRunFailureLabel(runStatus.failureKind, t)
                : null;
            const phaseNumber = getRunnablePhaseNumber(phase);

            return (
              <li key={phase}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePhaseClick(phase)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handlePhaseClick(phase);
                    }
                  }}
                  onMouseEnter={() => setHoveredPhase(phase)}
                  onMouseLeave={() => setHoveredPhase(null)}
                  className={cn(
                    "group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    isActive
                      ? "border-l-2 border-amber-500 bg-amber-500/10 pl-1.5"
                      : "border-l-2 border-transparent pl-1.5",
                    isRunning &&
                      !isActive &&
                      "border-l-2 border-amber-500 pl-1.5",
                    "hover:bg-zinc-800",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      isActive
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-zinc-700 text-zinc-300",
                    )}
                  >
                    {phaseNumber}
                  </span>

                  <span className="flex-1 truncate font-[Geist,sans-serif] text-[13px] font-medium text-zinc-200">
                    {t(PHASE_I18N_KEYS[phase])}
                  </span>

                  {failureLabel ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          aria-label={`Phase ${phaseNumber} failed: ${failureLabel}`}
                          className="shrink-0"
                        >
                          <StatusDot status={status} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {failureLabel}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <StatusDot status={status} />
                  )}

                  {entityCount > 0 && (
                    <span className="shrink-0 font-[Geist,sans-serif] text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                      {entityCount}
                    </span>
                  )}

                  {isHovered && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="ml-auto h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRerunPhase(phase);
                          }}
                        >
                          <RefreshCw className="h-3 w-3 text-zinc-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {t("analysis.sidebar.rerunPhase")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Search input */}
      <div className="border-t border-zinc-700 px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("analysis.sidebar.searchEntities")}
            className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-800 pl-7 pr-2 font-[Geist,sans-serif] text-[13px] font-medium text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>
    </aside>
  );
}

// ── Status dot sub-component ──

function StatusDot({ status }: { status: string }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "pending" && "bg-zinc-500",
        status === "complete" && "bg-emerald-400",
        status === "failed" && "bg-red-400",
        status === "needs-revalidation" && "bg-amber-400",
      )}
    />
  );
}
