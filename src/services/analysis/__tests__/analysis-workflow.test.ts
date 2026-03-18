import { describe, expect, it } from "vitest";
import { createAnalysisInsights } from "@/services/analysis/analysis-insights";
import { createDefaultAnalysis } from "@/services/analysis/analysis-normalization";
import { createAnalysisSummary } from "@/services/analysis/analysis-summary";
import {
  createAnalysisWorkflow,
  deriveWorkflowStageFromAnalysis,
} from "@/services/analysis/analysis-workflow";
import { validateAnalysis } from "@/services/analysis/analysis-validation";

function createWorkflowForCurrentStage(
  currentStage:
    | "details"
    | "strategies"
    | "payoffs"
    | "review"
    | "insights",
  analysis = createDefaultAnalysis(),
) {
  const validation = validateAnalysis(analysis);
  return createAnalysisWorkflow(
    analysis,
    validation,
    createAnalysisSummary(analysis, validation),
    createAnalysisInsights(analysis, validation),
    currentStage,
  );
}

describe("analysis workflow", () => {
  it("treats the default title as details attention without blocking later setup", () => {
    const analysis = createDefaultAnalysis();
    const workflow = createWorkflowForCurrentStage("details", analysis);

    expect(workflow.stages[0]).toMatchObject({
      stage: "details",
      status: "needs-attention",
      isCurrent: true,
    });
    expect(workflow.stages[1]).toMatchObject({
      stage: "strategies",
      status: "complete",
    });
    expect(workflow.stages[2]).toMatchObject({
      stage: "payoffs",
      status: "needs-attention",
    });
    expect(workflow.recommendedNextStage).toBe("details");
  });

  it("routes invalid player or strategy setup back to the strategies stage", () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "Pricing Game";
    analysis.players[0].name = " ";

    const validation = validateAnalysis(analysis);
    const workflow = createAnalysisWorkflow(
      analysis,
      validation,
      createAnalysisSummary(analysis, validation),
      createAnalysisInsights(analysis, validation),
      "review",
    );

    expect(deriveWorkflowStageFromAnalysis(analysis, validation)).toBe(
      "strategies",
    );
    expect(workflow.stages[1].status).toBe("needs-attention");
    expect(workflow.stages[2].status).toBe("blocked");
    expect(workflow.returnToStage).toBe("strategies");
  });

  it("keeps incomplete matrices on the payoffs stage and blocks review", () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "Pricing Game";

    const validation = validateAnalysis(analysis);
    const workflow = createAnalysisWorkflow(
      analysis,
      validation,
      createAnalysisSummary(analysis, validation),
      createAnalysisInsights(analysis, validation),
      "review",
    );

    expect(deriveWorkflowStageFromAnalysis(analysis, validation)).toBe(
      "payoffs",
    );
    expect(workflow.stages[2].status).toBe("needs-attention");
    expect(workflow.stages[3].status).toBe("blocked");
    expect(workflow.returnToStage).toBe("payoffs");
  });

  it("opens review and insights once the analysis is valid and complete", () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "Pricing Game";
    analysis.profiles = analysis.profiles.map((profile) => ({
      ...profile,
      payoffs: [3, 1] as [number, number],
    }));

    const workflow = createWorkflowForCurrentStage("review", analysis);

    expect(workflow.stages[3]).toMatchObject({
      stage: "review",
      status: "available",
      isCurrent: true,
    });
    expect(workflow.stages[4].status).toBe("available");
    expect(workflow.recommendedNextStage).toBe("insights");
  });

  it("keeps a regressed insights cursor but points back to payoffs", () => {
    const analysis = createDefaultAnalysis();
    analysis.name = "Pricing Game";

    const workflow = createWorkflowForCurrentStage("insights", analysis);

    expect(workflow.currentStage).toBe("insights");
    expect(workflow.stages[4].status).toBe("blocked");
    expect(workflow.returnToStage).toBe("payoffs");
  });
});
