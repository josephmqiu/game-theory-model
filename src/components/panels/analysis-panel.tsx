import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createAnalysisSummary } from "@/services/analysis/analysis-summary";
import { createAnalysisInsights } from "@/services/analysis/analysis-insights";
import {
  createAnalysisWorkflow,
  GUIDED_WORKFLOW_SECTION_IDS,
} from "@/services/analysis/analysis-workflow";
import { useAnalysisStore } from "@/stores/analysis-store";
import type { GuidedWorkflowStage } from "@/types/analysis";
import AnalysisReviewSection from "./analysis-review-section";
import PayoffMatrixSection from "./payoff-matrix-section";
import StrategicInsightsSection from "./strategic-insights-section";
import { AnalysisWorkflowNavigator } from "./analysis-workflow-navigator";

function WorkflowSection({
  id,
  isActive,
  sectionLabel,
  title,
  description,
  children,
  testId,
}: {
  id: string;
  isActive: boolean;
  sectionLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-sm transition-colors scroll-mt-28",
        isActive ? "border-primary ring-1 ring-primary/15" : "border-border",
      )}
      data-active-stage={isActive}
      data-testid={testId}
      tabIndex={-1}
    >
      <div className="space-y-2">
        <p
          className={cn(
            "text-sm font-medium",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {sectionLabel}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function focusWorkflowStage(stage: GuidedWorkflowStage) {
  const sectionId = GUIDED_WORKFLOW_SECTION_IDS[stage];
  const section = document.getElementById(sectionId);

  if (!section) {
    return;
  }

  if (typeof section.scrollIntoView === "function") {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (typeof section.focus === "function") {
    section.focus({ preventScroll: true });
  }
}

export default function AnalysisPanel() {
  const analysis = useAnalysisStore((state) => state.analysis);
  const validation = useAnalysisStore((state) => state.validation);
  const workflowState = useAnalysisStore((state) => state.workflow);
  const setWorkflowStage = useAnalysisStore((state) => state.setWorkflowStage);
  const renameAnalysis = useAnalysisStore((state) => state.renameAnalysis);
  const renamePlayer = useAnalysisStore((state) => state.renamePlayer);
  const addStrategy = useAnalysisStore((state) => state.addStrategy);
  const renameStrategy = useAnalysisStore((state) => state.renameStrategy);
  const removeStrategy = useAnalysisStore((state) => state.removeStrategy);
  const setPayoff = useAnalysisStore((state) => state.setPayoff);

  const summary = createAnalysisSummary(analysis, validation);
  const insights = createAnalysisInsights(analysis, validation);
  const workflow = createAnalysisWorkflow(
    analysis,
    validation,
    summary,
    insights,
    workflowState.currentStage,
  );

  const handleStageChange = (stage: GuidedWorkflowStage) => {
    setWorkflowStage(stage);
    focusWorkflowStage(stage);
  };

  return (
    <div className="flex flex-col gap-6">
      <AnalysisWorkflowNavigator
        workflow={workflow}
        onStageChange={handleStageChange}
      />

      <WorkflowSection
        id={GUIDED_WORKFLOW_SECTION_IDS.details}
        isActive={workflow.currentStage === "details"}
        sectionLabel="Analysis details"
        title="Canonical manual model"
        description="Name the analysis and keep the workflow grounded in the current two-player normal-form game before you move into strategies and payoffs."
        testId="analysis-details"
      >
        <label className="block max-w-3xl space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Analysis title
          </span>
          <input
            aria-label="Analysis title"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            value={analysis.name}
            onChange={(event) => renameAnalysis(event.target.value)}
            placeholder="Untitled Analysis"
          />
        </label>
      </WorkflowSection>

      <WorkflowSection
        id={GUIDED_WORKFLOW_SECTION_IDS.strategies}
        isActive={workflow.currentStage === "strategies"}
        sectionLabel="Players and strategies"
        title="Players and strategy setup"
        description="Define who is playing and the ordered strategies that set the payoff matrix axes."
        testId="analysis-strategies"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          {analysis.players.map((player, playerIndex) => (
            <section
              key={player.id}
              className="rounded-2xl border border-border/70 bg-background/60 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player {playerIndex + 1}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ordered strategies define the payoff matrix axes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addStrategy(player.id)}
                >
                  <Plus />
                  Add Strategy
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player name
                  </span>
                  <input
                    aria-label={`Player ${playerIndex + 1} name`}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    value={player.name}
                    onChange={(event) =>
                      renamePlayer(player.id, event.target.value)
                    }
                    placeholder={`Player ${playerIndex + 1}`}
                  />
                </label>

                <div className="space-y-3">
                  {player.strategies.map((strategy, strategyIndex) => (
                    <div
                      key={strategy.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
                    >
                      <div className="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {strategyIndex + 1}
                      </div>
                      <input
                        aria-label={`Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
                        value={strategy.name}
                        onChange={(event) =>
                          renameStrategy(
                            player.id,
                            strategy.id,
                            event.target.value,
                          )
                        }
                        placeholder={`Strategy ${strategyIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        onClick={() => removeStrategy(player.id, strategy.id)}
                        disabled={player.strategies.length <= 1}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </WorkflowSection>

      <PayoffMatrixSection
        analysis={analysis}
        setPayoff={setPayoff}
        insights={insights}
        isActive={workflow.currentStage === "payoffs"}
        sectionId={GUIDED_WORKFLOW_SECTION_IDS.payoffs}
      />

      <AnalysisReviewSection
        summary={summary}
        isActive={workflow.currentStage === "review"}
        sectionId={GUIDED_WORKFLOW_SECTION_IDS.review}
      />

      <StrategicInsightsSection
        insights={insights}
        isActive={workflow.currentStage === "insights"}
        sectionId={GUIDED_WORKFLOW_SECTION_IDS.insights}
      />
    </div>
  );
}
