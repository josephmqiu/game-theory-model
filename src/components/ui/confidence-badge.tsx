import { cn } from "@/lib/utils";

type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceBadgeProps {
  readonly level: ConfidenceLevel;
  readonly className?: string;
}

const levelConfig: Record<ConfidenceLevel, { label: string; classes: string }> =
  {
    high: {
      label: "High",
      classes: "bg-primary/15 text-primary border-primary/30",
    },
    medium: {
      label: "Medium",
      classes: "bg-accent text-accent-foreground border-border",
    },
    low: {
      label: "Low",
      classes: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };

export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const config = levelConfig[level];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
