import { homedir } from 'node:os'
import { join } from 'node:path'

export const APP_DISPLAY_NAME = 'Game Theory Analyzer'
export const GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV =
  'GAME_THEORY_ANALYZER_USER_DATA_DIR'
export const LEGACY_RUNTIME_DIR_NAME = '.game-theory-analyzer'
export const PORT_FILE_NAME = '.port'

type EnvLike = Record<string, string | undefined>

interface RuntimeStatePathOptions {
  env?: EnvLike
  homeDir?: string
  platform?: NodeJS.Platform
  userDataDir?: string
}

function getEnv(options?: RuntimeStatePathOptions): EnvLike {
  return options?.env ?? (process.env as EnvLike)
}

function getHomeDir(options?: RuntimeStatePathOptions): string {
  return options?.homeDir ?? homedir()
}

function getPlatform(options?: RuntimeStatePathOptions): NodeJS.Platform {
  return options?.platform ?? process.platform
}

export function getLegacyRuntimeStateDir(
  options?: RuntimeStatePathOptions,
): string {
  return join(getHomeDir(options), LEGACY_RUNTIME_DIR_NAME)
}

export function getConfiguredUserDataDir(
  options?: RuntimeStatePathOptions,
): string | null {
  const explicit = options?.userDataDir?.trim()
  if (explicit) return explicit

  const fromEnv = getEnv(options)[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]?.trim()
  return fromEnv || null
}

export function getComputedElectronUserDataDir(
  options?: RuntimeStatePathOptions,
): string {
  const env = getEnv(options)
  const home = getHomeDir(options)

  switch (getPlatform(options)) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_DISPLAY_NAME)
    case 'win32':
      return join(
        env.APPDATA || join(home, 'AppData', 'Roaming'),
        APP_DISPLAY_NAME,
      )
    default:
      return join(
        env.XDG_CONFIG_HOME || join(home, '.config'),
        APP_DISPLAY_NAME,
      )
  }
}

export function getWritableRuntimeStateDir(
  options?: RuntimeStatePathOptions,
): string {
  return (
    getConfiguredUserDataDir(options) ?? getLegacyRuntimeStateDir(options)
  )
}

export function getPortFilePath(options?: RuntimeStatePathOptions): string {
  return join(getWritableRuntimeStateDir(options), PORT_FILE_NAME)
}

export function getLegacyPortFilePath(options?: RuntimeStatePathOptions): string {
  return join(getLegacyRuntimeStateDir(options), PORT_FILE_NAME)
}

export function getPortFileReadCandidates(
  options?: RuntimeStatePathOptions,
): string[] {
  const seen = new Set<string>()
  const preferred = [
    join(
      getConfiguredUserDataDir(options) ?? getComputedElectronUserDataDir(options),
      PORT_FILE_NAME,
    ),
    getLegacyPortFilePath(options),
  ]

  return preferred.filter((candidate) => {
    if (seen.has(candidate)) return false
    seen.add(candidate)
    return true
  })
}

export function getServerLogDir(options?: RuntimeStatePathOptions): string {
  return join(getWritableRuntimeStateDir(options), 'logs')
}
