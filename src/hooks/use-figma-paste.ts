import { useEffect } from 'react'

/**
 * Phase 01 disables the Figma clipboard path in the live shell.
 * Keep the hook callable but make it a no-op so accidental mounts do nothing.
 */
export function useFigmaPaste() {
  useEffect(() => {
    return undefined
  }, [])
}

/**
 * Keep the keyboard shortcut fallback inert while the shell rebrand is in progress.
 */
export async function tryPasteFigmaFromClipboard(): Promise<boolean> {
  return false
}
