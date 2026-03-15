interface BreadcrumbProps {
  segments: string[]
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  if (segments.length === 0) return null

  return (
    <nav className="flex items-center gap-1 font-mono text-sm">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1

        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-text-dim mx-1">›</span>
            )}
            <span className={isLast ? 'text-text-primary font-semibold' : 'text-text-dim'}>
              {segment}
            </span>
          </span>
        )
      })}
    </nav>
  )
}
