import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const overlayPath = join(
  process.cwd(),
  "src/components/panels/analysis-report-overlay.tsx",
);
const entityOverlayPath = join(
  process.cwd(),
  "src/components/panels/entity-overlay-card.tsx",
);

const overlaySource = readFileSync(overlayPath, "utf8");
const entityOverlaySource = readFileSync(entityOverlayPath, "utf8");

describe("analysis report overlay — executive summary and structure", () => {
  it("displays the executive summary as primary text so the user sees the conclusion first", () => {
    expect(overlaySource).toContain("data.executive_summary");
    expect(overlaySource).toContain("text-[14px]");
  });

  it("organizes detail sections (Why, Evidence, Assumptions, What Changes This) as collapsible panels", () => {
    expect(overlaySource).toContain('title="Why"');
    expect(overlaySource).toContain('title="Key Evidence"');
    expect(overlaySource).toContain('title="Open Assumptions"');
    expect(overlaySource).toContain('title="What Changes This"');
  });

  it("expands the Why section by default so reasoning is immediately visible", () => {
    expect(overlaySource).toContain('<Section title="Why" defaultOpen>');
  });

  it("constrains overlay height to 70vh with scroll to prevent canvas obscuration", () => {
    expect(overlaySource).toContain("max-h-[70vh]");
    expect(overlaySource).toContain("overflow-y-auto");
  });
});

describe("analysis report overlay — prediction verdict display", () => {
  it("only renders the verdict section when prediction_verdict is non-null (no empty verdict box)", () => {
    expect(overlaySource).toContain("data.prediction_verdict &&");
    expect(overlaySource).toContain("VerdictSection");
  });

  it("shows verdict badge with semantic colors: green=underpriced, red=overpriced, yellow=fair", () => {
    expect(overlaySource).toContain('underpriced: "#4ADE80"');
    expect(overlaySource).toContain('overpriced: "#EF4444"');
    expect(overlaySource).toContain('fair: "#FBBF24"');
    expect(overlaySource).toContain("verdict.verdict.toUpperCase()");
  });

  it("displays probability comparison using tabular-nums for aligned percentage readability", () => {
    expect(overlaySource).toContain("predicted_probability");
    expect(overlaySource).toContain("market_probability");
    expect(overlaySource).toContain("tabular-nums");
    expect(overlaySource).toContain("% predicted");
    expect(overlaySource).toContain("% market");
  });

  it("shows the edge value with a sign prefix so users see +14 or -8 at a glance", () => {
    expect(overlaySource).toContain("verdict.edge");
    expect(overlaySource).toContain('verdict.edge > 0 ? "+" : ""');
  });
});

describe("analysis report overlay — entity reference navigation", () => {
  it("renders entity references as clickable chips for cross-entity navigation", () => {
    expect(overlaySource).toContain("onEntityClick(ref.entity_id)");
    expect(overlaySource).toContain("ref.display_name");
    expect(overlaySource).toContain("rounded-full");
  });

  it("makes entity reference chips keyboard-accessible with tabIndex and focus ring", () => {
    expect(overlaySource).toContain("tabIndex={0}");
    expect(overlaySource).toContain("focus:ring");
  });

  it("accepts an onEntityClick callback so the canvas can pan to the referenced entity", () => {
    expect(overlaySource).toContain(
      "onEntityClick: (entityId: string) => void",
    );
  });
});

describe("analysis report overlay — design system compliance", () => {
  it("uses DESIGN.md text hierarchy: zinc-200 primary, zinc-300 secondary, zinc-400 labels, zinc-500 headers", () => {
    expect(overlaySource).toContain("text-zinc-200");
    expect(overlaySource).toContain("text-zinc-300");
    expect(overlaySource).toContain("text-zinc-400");
    expect(overlaySource).toContain("text-zinc-500");
  });

  it("uses DESIGN.md font scale: 14px body, 13px data, 12px chips, 11px badges", () => {
    expect(overlaySource).toContain("text-[14px]");
    expect(overlaySource).toContain("text-[13px]");
    expect(overlaySource).toContain("text-[12px]");
    expect(overlaySource).toContain("text-[11px]");
  });

  it("imports AnalysisReportData type from the shared entity schema", () => {
    expect(overlaySource).toContain(
      'import type { AnalysisReportData } from "@/types/entity"',
    );
  });

  it("exports AnalysisReportOverlay as a named export for use in entity-overlay-card", () => {
    expect(overlaySource).toContain("export function AnalysisReportOverlay");
  });
});

describe("entity-overlay-card integration with analysis-report type", () => {
  it("assigns analysis-report the neutral zinc color (#A1A1AA) since it is a meta-entity, not a domain entity", () => {
    expect(entityOverlaySource).toContain('"analysis-report": "#A1A1AA"');
  });

  it("maps analysis-report to an i18n key for localized display name", () => {
    expect(entityOverlaySource).toContain(
      '"analysis-report": "analysis.entities.analysisReport"',
    );
  });

  it("extracts executive_summary as the entity display name in card headers", () => {
    expect(entityOverlaySource).toContain("d.executive_summary");
  });

  it("makes analysis-report non-editable since reports are AI-generated read-only artifacts", () => {
    const editMatch = entityOverlaySource.match(
      /case\s+"analysis-report":\s*\n\s*return\s+null/,
    );
    expect(editMatch).not.toBeNull();
  });

  it("renders the AnalysisReportOverlay component inside the entity data section", () => {
    expect(entityOverlaySource).toContain("AnalysisReportOverlay");
    expect(entityOverlaySource).toContain("analysis-report-overlay");
  });

  it("wires onEntityClick to the overlay for cross-entity navigation", () => {
    expect(entityOverlaySource).toContain("onEntityClick");
  });
});
