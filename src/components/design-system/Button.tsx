import type { ReactNode } from 'react'

interface ButtonProps {
  variant: 'primary' | 'secondary'
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}

export function Button({ variant, icon, onClick, disabled, children }: ButtonProps) {
  const base =
    'inline-flex items-center gap-2 px-[18px] py-[10px] font-mono font-semibold rounded transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-accent text-bg-page hover:opacity-90',
    secondary: 'bg-transparent border border-border text-text-primary hover:opacity-80',
  }

  return (
    <button
      className={`${base} ${variants[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
