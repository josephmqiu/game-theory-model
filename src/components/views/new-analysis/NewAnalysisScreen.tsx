import type { ReactNode } from 'react'

export function NewAnalysisScreen(): ReactNode {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-8">
      <h1 className="text-xl font-bold text-text-primary mb-6">New Analysis</h1>
      <textarea
        className="w-full max-w-2xl h-32 bg-bg-surface border border-border rounded-lg p-4 text-text-primary placeholder-text-muted resize-none"
        placeholder="Describe the event or strategic situation you want to analyze..."
      />
      <div className="flex gap-3 mt-4">
        <button type="button" className="px-6 py-2 bg-accent text-black rounded-lg font-medium">Begin Analysis</button>
        <button type="button" className="px-6 py-2 bg-bg-surface border border-border text-text-primary rounded-lg">Manual Mode</button>
      </div>
    </div>
  )
}
