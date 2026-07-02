/**
 * Module-level singleton reference to the active SkiaEngine instance.
 * Set by SkiaCanvas on mount, cleared on unmount.
 * Allows external code to access the mounted engine without prop-drilling.
 */

import type { SkiaEngine } from './skia/skia-engine'

let _engine: SkiaEngine | null = null

export function setSkiaEngineRef(engine: SkiaEngine | null) {
  _engine = engine
}

export function getSkiaEngineRef(): SkiaEngine | null {
  return _engine
}
