import type { ReactNode } from 'react'

interface ViewTabProps {
  icon: ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

export function ViewTab({ icon, label, active = false, onClick }: ViewTabProps) {
  const base =
    'flex items-center gap-[6px] px-[14px] py-2 cursor-pointer font-mono text-sm transition-colors'

  const activeStyles = 'text-accent bg-accent-15 border-b-2 border-accent'
  const inactiveStyles = 'text-text-dim hover:text-text-muted'

  return (
    <button
      type="button"
      className={`${base} ${active ? activeStyles : inactiveStyles}`}
      onClick={onClick}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
