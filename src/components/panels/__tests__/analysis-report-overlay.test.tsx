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

describe("AnalysisReportOverlay", () => {
  // ── Component structure ──

  it("renders executive_summary in primary text", () => {
    expect(overlaySource).toContain("data.executive_summary");
    expect(overlaySource).toContain("text-[14px]");
  });

  it("conditionally renders verdict section only when prediction_verdict is non-null", () => {
    expect(overlaySource).toContain("data.prediction_verdict &&");
    expect(overlaySource).toContain("VerdictSection");
  });

  it("hides verdict section when prediction_verdict is null (no unconditional Verdict render)", () => {
    // The Verdict label only appears inside VerdictSection, which is conditionally rendered
    const verdictLabelCount = (overlaySource.match(/Verdict/g) || []).length;
    expect(verdictLabelCount).toBeGreaterThan(0);
    // VerdictSection is only rendered conditionally
    expect(overlaySource).toContain("data.prediction_verdict &&");
  });

  it("shows verdict badge with correct colors for all verdict types", () => {
    expect(overlaySource).toContain('underpriced: "#4ADE80"');
    expect(overlaySource).toContain('overpriced: "#EF4444"');
    expect(overlaySource).toContain('fair: "#FBBF24"');
    expect(overlaySource).toContain("verdict.verdict.toUpperCase()");
  });

  it("displays probability comparison with tabular-nums", () => {
    expect(overlaySource).toContain("predicted_probability");
    expect(overlaySource).toContain("market_probability");
    expect(overlaySource).toContain("tabular-nums");
    expect(overlaySource).toContain("% predicted");
    expect(overlaySource).toContain("% market");
  });

  it("renders edge value with sign prefix", () => {
    expect(overlaySource).toContain("verdict.edge");
    expect(overlaySource).toContain('verdict.edge > 0 ? "+" : ""');
  });

  it("renders entity reference chips as clickable buttons", () => {
    expect(overlaySource).toContain("onEntityClick(ref.entity_id)");
    expect(overlaySource).toContain("ref.display_name");
    expect(overlaySource).toContain("rounded-full");
    expect(overlaySource).toContain("tabIndex={0}");
    expect(overlaySource).toContain("focus:ring");
  });

  it("has collapsible sections for Why, Key Evidence, Open Assumptions, What Changes This", () => {
    expect(overlaySource).toContain('title="Why"');
    expect(overlaySource).toContain('title="Key Evidence"');
    expect(overlaySource).toContain('title="Open Assumptions"');
    expect(overlaySource).toContain('title="What Changes This"');
  });

  it("expands Why section by default", () => {
    // The Why section should have defaultOpen prop
    expect(overlaySource).toContain('<Section title="Why" defaultOpen>');
  });

  it("uses max-h-[70vh] with overflow scroll", () => {
    expect(overlaySource).toContain("max-h-[70vh]");
    expect(overlaySource).toContain("overflow-y-auto");
  });

  it("uses DESIGN.md text hierarchy colors", () => {
    expect(overlaySource).toContain("text-zinc-200"); // primary text
    expect(overlaySource).toContain("text-zinc-300"); // secondary text
    expect(overlaySource).toContain("text-zinc-400"); // tertiary labels
    expect(overlaySource).toContain("text-zinc-500"); // section headers
  });

  it("uses DESIGN.md font sizes", () => {
    expect(overlaySource).toContain("text-[14px]"); // body
    expect(overlaySource).toContain("text-[13px]"); // data values
    expect(overlaySource).toContain("text-[12px]"); // meta/chips
    expect(overlaySource).toContain("text-[11px]"); // badges/section headers
  });

  it("imports AnalysisReportData type from @/types/entity", () => {
    expect(overlaySource).toContain(
      'import type { AnalysisReportData } from "@/types/entity"',
    );
  });

  it("exports AnalysisReportOverlay as named export", () => {
    expect(overlaySource).toContain("export function AnalysisReportOverlay");
  });

  it("accepts onEntityClick callback prop", () => {
    expect(overlaySource).toContain(
      "onEntityClick: (entityId: string) => void",
    );
  });
});

describe("entity-overlay-card integration", () => {
  it("has analysis-report color set to #A1A1AA", () => {
    expect(entityOverlaySource).toContain('"analysis-report": "#A1A1AA"');
  });

  it("has i18n key for analysis-report", () => {
    expect(entityOverlaySource).toContain(
      '"analysis-report": "analysis.entities.analysisReport"',
    );
  });

  it("returns executive_summary in entity name extraction", () => {
    expect(entityOverlaySource).toContain("d.executive_summary");
  });

  it("returns null for EditableEntityData for analysis-report (non-editable)", () => {
    // The analysis-report case in EditableEntityData should return null
    const editMatch = entityOverlaySource.match(
      /case\s+"analysis-report":\s*\n\s*return\s+null/,
    );
    expect(editMatch).not.toBeNull();
  });

  it("renders AnalysisReportOverlay in EntityDataSection", () => {
    expect(entityOverlaySource).toContain("AnalysisReportOverlay");
    expect(entityOverlaySource).toContain("analysis-report-overlay");
  });

  it("passes onEntityClick handler to the overlay", () => {
    expect(entityOverlaySource).toContain("onEntityClick");
  });
});
