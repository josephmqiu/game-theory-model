interface ConfidenceBadgeProps {
  value: number
}

function getColor(value: number): string {
  if (value >= 0.7) return '#22C55E'
  if (value >= 0.4) return '#F59E0B'
  return '#EF4444'
}

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const color = getColor(value)
  const bg = `${color}33`

  return (
    <span
      className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded font-mono text-[10px] font-bold"
      style={{ color, backgroundColor: bg }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, backgroundColor: color }}
      />
      {value.toFixed(2)}
    </span>
  )
}
