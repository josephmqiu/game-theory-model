import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, win32 } from 'node:path'

type EnvLike = Record<string, string | undefined>

function splitPathList(value: string, delimiter: string): string[] {
  return value.split(delimiter).filter(Boolean)
}

function getNvmBinDirs(homeDir: string): string[] {
  const nvmCurrentDir = join(homeDir, '.nvm', 'current', 'bin')
  const versionRoot = join(homeDir, '.nvm', 'versions', 'node')
  const versionBins: string[] = []

  try {
    const entries = readdirSync(versionRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(versionRoot, entry.name, 'bin'))
      .sort()
      .reverse()
    versionBins.push(...entries)
  } catch {
    // Ignore when nvm is not installed.
  }

  return [nvmCurrentDir, ...versionBins]
}

export function buildAugmentedGuiPath(
  platform: NodeJS.Platform,
  currentPath: string | undefined,
  homeDir: string,
): string | undefined {
  if (platform === 'win32') {
    const extraDirs = [
      win32.join(homeDir, 'AppData', 'Roaming', 'npm'),
      win32.join(
        homeDir,
        'AppData',
        'Local',
        'Programs',
        'Microsoft VS Code',
        'bin',
      ),
      win32.join(homeDir, '.cargo', 'bin'),
      win32.join(homeDir, 'scoop', 'shims'),
      win32.join(homeDir, '.bun', 'bin'),
    ]
    const current = currentPath || ''
    const entries = splitPathList(current, ';')
    const existing = new Set(entries.map((entry) => entry.toLowerCase()))
    const additions = extraDirs.filter((entry) => !existing.has(entry.toLowerCase()))
    return additions.length > 0 ? [...additions, ...entries].join(';') : currentPath
  }

  if (platform !== 'darwin' && platform !== 'linux') return currentPath

  const extraDirs = [
    join(homeDir, '.local', 'bin'),
    join(homeDir, '.asdf', 'shims'),
    join(homeDir, '.mise', 'shims'),
    join(homeDir, '.local', 'share', 'mise', 'shims'),
    join(homeDir, '.volta', 'bin'),
    ...getNvmBinDirs(homeDir),
    join(homeDir, '.cargo', 'bin'),
    join(homeDir, '.bun', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/home/linuxbrew/.linuxbrew/bin',
  ]
  const current = currentPath || ''
  const entries = splitPathList(current, ':')
  const existing = new Set(entries)
  const additions = extraDirs.filter((entry) => !existing.has(entry))
  return additions.length > 0 ? [...additions, ...entries].join(':') : currentPath
}

export function applyGuiPathFix(
  env: EnvLike = process.env as EnvLike,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = homedir(),
): void {
  const nextPath = buildAugmentedGuiPath(platform, env.PATH, homeDir)
  if (nextPath !== undefined) {
    env.PATH = nextPath
  }
}
