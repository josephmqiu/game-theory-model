import { useState } from 'react'
import type { ReactNode } from 'react'
import { PlusCircle } from 'lucide-react'

import { Button } from '../design-system'
import { CreatePlayerWizard, CreateNodeWizard } from '../editors/wizards'

export function EmptyStateNewGame(): ReactNode {
  const [showCreatePlayer, setShowCreatePlayer] = useState(false)
  const [showCreateNode, setShowCreateNode] = useState(false)

  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="text-center max-w-md">
        <PlusCircle size={48} className="text-accent mx-auto mb-4" />
        <h2 className="font-mono font-bold text-lg tracking-widest text-text-primary mb-2">
          Start Building Your Game
        </h2>
        <p className="font-mono text-sm text-text-muted mb-6 leading-relaxed">
          This game has no formalization yet. Add players and decision nodes to begin
          modeling the strategic situation.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => setShowCreatePlayer(true)}>
            ADD PLAYER
          </Button>
          <Button variant="primary" onClick={() => setShowCreateNode(true)}>
            ADD DECISION NODE
          </Button>
        </div>
      </div>

      <CreatePlayerWizard open={showCreatePlayer} onClose={() => setShowCreatePlayer(false)} />
      <CreateNodeWizard open={showCreateNode} onClose={() => setShowCreateNode(false)} />
    </div>
  )
}
