import { ConfidenceBadge } from './ConfidenceBadge'

interface EstimateValueDisplayProps {
  estimate: {
    value?: number
    confidence: number
    representation: string
  }
}

export function EstimateValueDisplay({ estimate }: EstimateValueDisplayProps) {
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border font-mono text-sm text-text-primary bg-bg-card">
      <span>{estimate.value !== undefined ? estimate.value : '—'}</span>
      <ConfidenceBadge value={estimate.confidence} />
    </span>
  )
}
