import type { ReactNode } from 'react'

interface NavItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

export function NavItem({ icon, label, active = false, onClick }: NavItemProps) {
  const base =
    'flex items-center gap-[10px] px-4 py-[10px] cursor-pointer font-mono text-sm transition-colors w-full'

  const activeStyles = 'text-accent bg-accent-15 border-l-[3px] border-accent pl-[13px]'
  const inactiveStyles = 'text-text-dim hover:text-text-muted hover:bg-white/5'

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
