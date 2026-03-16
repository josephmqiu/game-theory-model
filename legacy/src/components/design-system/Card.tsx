import type { ReactNode } from 'react'

interface CardProps {
  title: string
  children: ReactNode
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="bg-bg-card border border-border rounded p-5">
      <h3 className="font-heading text-sm font-bold tracking-wide text-text-primary mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
