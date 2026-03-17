/**
 * Settings page helper components and utility functions.
 */

import type {
  AIProviderConfig,
  MCPCliIntegration,
} from "@/types/agent-settings";

export function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ready" | "pending" | "missing";
}) {
  const classes =
    tone === "ready"
      ? "bg-green-500/10 text-green-600"
      : tone === "missing"
        ? "bg-red-500/10 text-red-600"
        : "bg-secondary text-muted-foreground";

  return <span className={`rounded-full px-2 py-0.5 ${classes}`}>{label}</span>;
}

export function providerStageBadge(config: AIProviderConfig): {
  label: string;
  tone: "ready" | "pending" | "missing";
} {
  switch (config.statusStage) {
    case "ready":
      return { label: "Ready", tone: "ready" };
    case "authenticated":
      return { label: "Authenticated", tone: "ready" };
    case "detected":
      return { label: "Detected", tone: "pending" };
    case "error":
      return { label: "Error", tone: "missing" };
    case "missing_binary":
    default:
      return { label: "Missing", tone: "missing" };
  }
}

export function integrationStageBadge(integration: MCPCliIntegration): {
  label: string;
  tone: "ready" | "pending" | "missing";
} {
  switch (integration.statusStage) {
    case "ready":
      return { label: "Ready", tone: "ready" };
    case "reachable":
      return { label: "Reachable", tone: "ready" };
    case "config_written":
      return { label: "Config written", tone: "pending" };
    case "detected":
      return { label: "Detected", tone: "pending" };
    case "error":
      return { label: "Error", tone: "missing" };
    case "missing_binary":
    default:
      return { label: "Missing", tone: "missing" };
  }
}
