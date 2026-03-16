import type { ReactNode } from 'react'
import { WifiOff } from 'lucide-react'

import { Button } from '../design-system'

interface EmptyStateNoAIProps {
  onSetupGuide?: () => void
  onContinueWithoutAI?: () => void
}

export function EmptyStateNoAI({ onSetupGuide, onContinueWithoutAI }: EmptyStateNoAIProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <WifiOff size={36} className="text-text-dim mb-4" />
      <h3 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-2">
        No AI Client Connected
      </h3>
      <p className="font-mono text-xs text-text-muted text-center max-w-sm mb-6 leading-relaxed">
        The platform is fully functional without AI. You can manually model games,
        players, and strategic situations. Connect an MCP-capable AI client
        (Claude Desktop, ChatGPT) to enable assisted analysis and play-out sessions.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onSetupGuide}>
          MCP SETTINGS
        </Button>
        <Button variant="primary" onClick={onContinueWithoutAI}>
          CONTINUE WITHOUT AI
        </Button>
      </div>
    </div>
  )
}
