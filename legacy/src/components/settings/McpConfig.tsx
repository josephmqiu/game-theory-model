import type { ReactNode } from 'react'

import { Button, Card } from '../design-system'
import { updateMcpConfig, useMcpConnectionStatus, useMcpStore } from '../../store'

export function McpConfig(): ReactNode {
  const status = useMcpConnectionStatus()
  const config = useMcpStore((state) => state.config)

  return (
    <Card title="MCP Server">
      <div className="space-y-4 text-sm text-text-muted">
        <div>
          <div className="font-semibold text-text-primary">Connection status</div>
          <div className="mt-1">
            {status.connected
              ? `${status.client_name ?? 'Client'} connected over ${status.transport}`
              : 'No MCP client connected. Manual modeling remains fully available.'}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded border border-border bg-bg-surface p-3">
            <div className="font-semibold text-text-primary">stdio transport</div>
            <div className="mt-1 text-xs">Primary browser-safe target for local MCP clients.</div>
            <div className="mt-3">
              <Button
                variant={config.stdio_enabled ? 'primary' : 'secondary'}
                onClick={() => updateMcpConfig({ stdio_enabled: !config.stdio_enabled })}
              >
                {config.stdio_enabled ? 'Enabled' : 'Enable stdio'}
              </Button>
            </div>
          </div>

          <div className="rounded border border-border bg-bg-surface p-3">
            <div className="font-semibold text-text-primary">HTTP transport</div>
            <div className="mt-1 text-xs">Deferred in this browser-first repo. Kept visible but disabled by default.</div>
            <div className="mt-3">
              <Button
                variant={config.http_enabled ? 'primary' : 'secondary'}
                onClick={() => updateMcpConfig({ http_enabled: !config.http_enabled })}
              >
                {config.http_enabled ? 'Enabled' : 'Enable HTTP'}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-xs text-text-dim">
          Host: {config.http_host} · Port: {config.http_port}
        </div>
      </div>
    </Card>
  )
}
