import type { ReactNode } from 'react'

export function SettingsScreen(): ReactNode {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-lg font-bold text-text-primary mb-4">Settings</h1>
      <p className="text-sm text-text-muted">AI provider configuration — coming in M5</p>
    </div>
  )
}
