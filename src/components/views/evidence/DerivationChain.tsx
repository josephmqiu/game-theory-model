import type { ReactNode } from 'react'

import { Badge } from '../../design-system'
import type { DerivationChainResult } from '../../../store/selectors/evidence-notebook-selectors'

interface DerivationChainProps {
  entityId: string
  chain: DerivationChainResult
}

export function DerivationChain({ entityId, chain }: DerivationChainProps): ReactNode {
  if (chain.upstream.length === 0 && chain.downstream.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs font-mono text-text-muted">
      {chain.upstream.map((link) => (
        <span key={link.id} className="inline-flex items-center gap-1">
          <span className="text-text-muted truncate max-w-[80px]">{link.entityId}</span>
          <Badge>{link.relation}</Badge>
          <span className="text-text-muted">&rarr;</span>
        </span>
      ))}

      <span className="font-bold text-text-primary px-1">{entityId}</span>

      {chain.downstream.map((link) => (
        <span key={link.id} className="inline-flex items-center gap-1">
          <span className="text-text-muted">&rarr;</span>
          <Badge>{link.relation}</Badge>
          <span className="text-text-muted truncate max-w-[80px]">{link.entityId}</span>
        </span>
      ))}
    </div>
  )
}
