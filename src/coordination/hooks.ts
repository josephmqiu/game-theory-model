import { useEffect, useRef } from 'react'

import type { CoordinationEvent, CoordinationEventKind } from './types'
import { coordinationBus } from './index'

export function useCoordinationHandler(
  kind: CoordinationEventKind,
  handler: (event: CoordinationEvent) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    return coordinationBus.subscribe(kind, (e) => handlerRef.current(e))
  }, [kind])
}
