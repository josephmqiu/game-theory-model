import { TriangleAlert } from 'lucide-react'

export function StaleBadge() {
  return (
    <span className="inline-flex items-center gap-[5px] px-2 py-[3px] rounded font-mono text-[10px] font-bold text-warning bg-warning-20">
      <TriangleAlert size={10} />
      STALE
    </span>
  )
}
