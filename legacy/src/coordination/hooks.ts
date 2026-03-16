import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { CoordinationEvent, CoordinationEventKind } from './types'
import { coordinationBus } from './index'
import type { ViewType } from '../store/app-store'

type OutboundCoordinationEvent = { kind: CoordinationEventKind } & Record<string, unknown>

export interface CoordinationChannel {
  emit: (event: OutboundCoordinationEvent) => void
  subscribe: (
    kind: CoordinationEventKind,
    handler: (event: CoordinationEvent) => void,
  ) => () => void
}

export function useCoordinationChannel(sourceView: ViewType): CoordinationChannel {
  const emittedCorrelationIdsRef = useRef<Set<string>>(new Set())

  const emit = useCallback((event: OutboundCoordinationEvent) => {
    const correlationId = crypto.randomUUID()
    emittedCorrelationIdsRef.current.add(correlationId)
    coordinationBus.emit({
      ...event,
      source_view: sourceView,
      correlation_id: correlationId,
    } as CoordinationEvent)
  }, [sourceView])

  const subscribe = useCallback(
    (kind: CoordinationEventKind, handler: (event: CoordinationEvent) => void) =>
      coordinationBus.subscribe(kind, (event) => {
        if (event.source_view === sourceView) {
          return
        }

        if (emittedCorrelationIdsRef.current.delete(event.correlation_id)) {
          return
        }

        handler(event)
      }),
    [sourceView],
  )

  return useMemo(() => ({ emit, subscribe }), [emit, subscribe])
}

export function useCoordinationHandler(
  channel: CoordinationChannel,
  kind: CoordinationEventKind,
  handler: (event: CoordinationEvent) => void,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return channel.subscribe(kind, (event) => handlerRef.current(event))
  }, [channel, kind])
}
