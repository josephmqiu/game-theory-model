export { createCoordinationBus } from './bus'
export { useCoordinationHandler } from './hooks'
export type {
  CoordinationBus,
  CoordinationEvent,
  CoordinationEventKind,
  CoordinationSnapshot,
} from './types'

import { createCoordinationBus } from './bus'

export const coordinationBus = createCoordinationBus()
