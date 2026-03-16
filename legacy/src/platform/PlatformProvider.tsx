import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Platform, FileService, ShellService } from './types'
import { detectPlatform } from './detect'
import { BrowserFileService } from './browser-file-service'
import { BrowserShellService } from './browser-shell-service'
import { TauriFileService } from './tauri-file-service'
import { TauriShellService } from './tauri-shell-service'

interface PlatformContext {
  readonly platform: Platform
  readonly fileService: FileService
  readonly shellService: ShellService
}

const PlatformCtx = createContext<PlatformContext | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useMemo<PlatformContext>(() => {
    const platform = detectPlatform()
    if (platform.type === 'tauri') {
      return { platform, fileService: new TauriFileService(), shellService: new TauriShellService() }
    }
    return { platform, fileService: new BrowserFileService(), shellService: new BrowserShellService() }
  }, [])

  return <PlatformCtx.Provider value={value}>{children}</PlatformCtx.Provider>
}

export function usePlatform(): PlatformContext {
  const ctx = useContext(PlatformCtx)
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider')
  return ctx
}
