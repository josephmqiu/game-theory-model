import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Target } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: WelcomePage,
  head: () => ({
    meta: [{ title: 'Game Theory Analyzer' }],
  }),
})

function WelcomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Target size={40} className="text-primary" />
          <h1 className="text-5xl font-bold tracking-tight">
            Game Theory
            <span className="text-primary"> Analyzer</span>
          </h1>
        </div>
        <p className="text-xl text-muted-foreground">
          AI-powered strategic analysis with rigorous game theory methodology
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          to="/editor"
          className="inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <Plus size={18} />
          New Analysis
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Press Ctrl+N to create a new analysis
      </p>
    </div>
  )
}
