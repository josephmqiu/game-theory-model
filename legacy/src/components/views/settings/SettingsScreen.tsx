import type { ReactNode } from 'react'

import { McpConfig } from '../../settings/McpConfig'

export function SettingsScreen(): ReactNode {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-lg font-bold text-text-primary mb-4">Settings</h1>
      <p className="mb-4 text-sm text-text-muted">
        MCP connection and transport settings for the browser-first M5 shell.
      </p>
      <McpConfig />
    </div>
  )
}
