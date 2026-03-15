import { useEffect } from 'react'

import type { CoordinationEvent, CoordinationEventKind } from './types'
import { coordinationBus } from './index'

export function useCoordinationHandler(
  kind: CoordinationEventKind,
  handler: (event: CoordinationEvent) => void,
): void {
  useEffect(() => {
    return coordinationBus.subscribe(kind, handler)
  }, [kind, handler])
}
