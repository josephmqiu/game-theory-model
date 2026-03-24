import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnalysisReportData } from "@/types/entity";

// ── Verdict badge color map ──

const VERDICT_COLORS: Record<string, string> = {
  underpriced: "#4ADE80",
  overpriced: "#EF4444",
  fair: "#FBBF24",
};

// ── Collapsible section ──

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 hover:text-zinc-400"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="pb-1 pl-[18px] pt-0.5">{children}</div>}
    </div>
  );
}

// ── Bulleted list ──

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-2 text-[13px] leading-relaxed text-zinc-300"
        >
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Verdict section ──

function VerdictSection({
  verdict,
}: {
  verdict: NonNullable<AnalysisReportData["prediction_verdict"]>;
}) {
  const verdictColor = verdict.verdict
    ? (VERDICT_COLORS[verdict.verdict] ?? "#A1A1AA")
    : "#A1A1AA";

  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
          Verdict
        </span>
        {verdict.verdict && (
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: verdictColor }}
          >
            {verdict.verdict.toUpperCase()}
          </span>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-zinc-300">
        {verdict.event_question}
      </p>

      <div className="flex items-baseline gap-3">
        <span className="font-[Geist,sans-serif] text-[13px] tabular-nums text-zinc-200">
          {verdict.predicted_probability}% predicted
        </span>
        {verdict.market_probability != null && (
          <span className="font-[Geist,sans-serif] text-[13px] tabular-nums text-zinc-400">
            vs ~{verdict.market_probability}% market
          </span>
        )}
      </div>

      {verdict.edge != null && (
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">
            Edge
          </span>
          <span
            className="font-[Geist,sans-serif] text-[13px] font-medium tabular-nums"
            style={{ color: verdictColor }}
          >
            {verdict.edge > 0 ? "+" : ""}
            {verdict.edge}%
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {verdict.bet_direction && (
          <span className="text-[11px] text-zinc-400">
            Direction:{" "}
            <span className="font-medium text-zinc-300">
              {verdict.bet_direction}
            </span>
          </span>
        )}
        {verdict.confidence && (
          <span className="text-[11px] text-zinc-400">
            Confidence:{" "}
            <span className="font-medium text-zinc-300">
              {verdict.confidence}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Entity reference chips ──

function EntityRefChips({
  refs,
  onEntityClick,
}: {
  refs: AnalysisReportData["entity_references"];
  onEntityClick: (entityId: string) => void;
}) {
  if (refs.length === 0) return null;
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        Referenced Entities
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {refs.map((ref) => (
          <button
            key={ref.entity_id}
            type="button"
            tabIndex={0}
            onClick={() => onEntityClick(ref.entity_id)}
            className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[12px] text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {ref.display_name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main overlay ──

export interface AnalysisReportOverlayProps {
  data: AnalysisReportData;
  onEntityClick: (entityId: string) => void;
}

export function AnalysisReportOverlay({
  data,
  onEntityClick,
}: AnalysisReportOverlayProps) {
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto">
      {/* Executive summary */}
      <p className="text-[14px] leading-relaxed text-zinc-200">
        {data.executive_summary}
      </p>

      {/* Verdict — conditional */}
      {data.prediction_verdict && (
        <VerdictSection verdict={data.prediction_verdict} />
      )}

      {/* Why — expanded by default */}
      <Section title="Why" defaultOpen>
        <p className="text-[13px] leading-relaxed text-zinc-300">{data.why}</p>
      </Section>

      {/* Key Evidence */}
      <Section title="Key Evidence" defaultOpen>
        <BulletList items={data.key_evidence} />
      </Section>

      {/* Open Assumptions */}
      {data.open_assumptions.length > 0 && (
        <Section title="Open Assumptions">
          <BulletList items={data.open_assumptions} />
        </Section>
      )}

      {/* What Changes This */}
      {data.what_would_change.length > 0 && (
        <Section title="What Changes This">
          <BulletList items={data.what_would_change} />
        </Section>
      )}

      {/* Entity references */}
      <EntityRefChips
        refs={data.entity_references}
        onEntityClick={onEntityClick}
      />
    </div>
  );
}
