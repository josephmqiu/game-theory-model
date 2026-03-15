import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
}

export function Badge({ children, color }: BadgeProps) {
  const style = color ? { color, backgroundColor: `${color}26` } : undefined

  const base =
    'inline-flex items-center px-2 py-[3px] rounded text-[10px] font-mono font-bold uppercase tracking-wide'
  const defaultColors = 'text-accent bg-accent-15'

  return (
    <span className={`${base} ${color ? '' : defaultColors}`} style={style}>
      {children}
    </span>
  )
}
