import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getClaudeCacheDir,
  getClaudeConfigDir,
  getClaudeDataDir,
  getClaudeHomeDir,
  getClaudeStateDir,
} from '../../src/lib/runtime-state-paths'

type EnvLike = Record<string, string | undefined>

interface ClaudeSettings {
  env?: Record<string, unknown>
}

interface ClaudePersistentState {
  anonymousId?: unknown
  customApiKeyResponses?: unknown
  oauthAccount?: unknown
  userID?: unknown
}

const STRIPPED_PROCESS_ENV_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_CUSTOM_HEADERS',
])

function normalizeEnvValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    // Filter out empty strings - they cause issues
    if (value.trim() === '') return undefined
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  // ANTHROPIC_CUSTOM_HEADERS can be an object in settings.json — serialize it.
  // Other object values are skipped to prevent "Invalid header name" errors.
  if (typeof value === 'object') {
    if (key === 'ANTHROPIC_CUSTOM_HEADERS') {
      try { return JSON.stringify(value) } catch { return undefined }
    }
    return undefined
  }
  return undefined
}

function readSingleSettingsFile(filePath: string): EnvLike {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as ClaudeSettings
    if (!parsed.env || typeof parsed.env !== 'object') return {}

    const env: EnvLike = {}
    for (const [key, value] of Object.entries(parsed.env)) {
      const normalized = normalizeEnvValue(key, value)
      if (normalized !== undefined) {
        env[key] = normalized
      }
    }
    return env
  } catch {
    return {}
  }
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

/**
 * Read env from ~/.claude/settings.json and ~/.claude/settings.local.json.
 * Local settings take priority (same as Claude Code's own precedence).
 */
function readClaudeSettingsEnv(): EnvLike {
  const claudeDir = join(homedir(), '.claude')
  const base = readSingleSettingsFile(join(claudeDir, 'settings.json'))
  const local = readSingleSettingsFile(join(claudeDir, 'settings.local.json'))
  return { ...base, ...local }
}

function sanitizeClaudePersistentState(
  state: ClaudePersistentState | null,
): Record<string, unknown> {
  if (!state || typeof state !== 'object') return {}

  const sanitized: Record<string, unknown> = {}
  if (state.oauthAccount && typeof state.oauthAccount === 'object') {
    sanitized.oauthAccount = state.oauthAccount
  }
  if (typeof state.userID === 'string' && state.userID.trim().length > 0) {
    sanitized.userID = state.userID
  }
  if (
    state.customApiKeyResponses &&
    typeof state.customApiKeyResponses === 'object'
  ) {
    sanitized.customApiKeyResponses = state.customApiKeyResponses
  }
  if (
    typeof state.anonymousId === 'string' &&
    state.anonymousId.trim().length > 0
  ) {
    sanitized.anonymousId = state.anonymousId
  }

  return sanitized
}

function writeJsonFile(filePath: string, data: Record<string, unknown>): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function seedIsolatedClaudeState(homeDir: string, configDir: string): void {
  const persistentState = sanitizeClaudePersistentState(
    readJsonFile<ClaudePersistentState>(join(homedir(), '.claude.json')),
  )

  if (Object.keys(persistentState).length === 0) {
    return
  }

  writeJsonFile(join(configDir, '.claude.json'), persistentState)
  writeJsonFile(join(homeDir, '.claude.json'), persistentState)
}

function ensureIsolatedClaudeRuntime(): {
  cacheDir: string
  configDir: string
  dataDir: string
  homeDir: string
  stateDir: string
} {
  const homeDir = getClaudeHomeDir()
  const configDir = getClaudeConfigDir()
  const cacheDir = getClaudeCacheDir()
  const dataDir = getClaudeDataDir()
  const stateDir = getClaudeStateDir()

  for (const dir of [homeDir, configDir, cacheDir, dataDir, stateDir]) {
    mkdirSync(dir, { recursive: true })
  }

  seedIsolatedClaudeState(homeDir, configDir)

  return { cacheDir, configDir, dataDir, homeDir, stateDir }
}

/**
 * Validate if a string is valid JSON (for ANTHROPIC_CUSTOM_HEADERS).
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * Build env passed to Claude Agent SDK.
 * Preserve the current process environment for normal runtime behavior, but do
 * not inherit ambient direct-auth Anthropic env vars from the shell. Claude-
 * specific auth overrides must come from Claude settings files on purpose.
 */
export function buildClaudeAgentEnv(): EnvLike {
  const fromSettings = readClaudeSettingsEnv()
  const isolatedRuntime = ensureIsolatedClaudeRuntime()
  const fromProcess: EnvLike = {}

  for (const [key, value] of Object.entries(process.env as EnvLike)) {
    if (value === undefined) continue
    if (STRIPPED_PROCESS_ENV_KEYS.has(key)) continue
    fromProcess[key] = value
  }

  const merged: EnvLike = {
    ...fromProcess,
    ...fromSettings,
    CLAUDE_CONFIG_DIR: isolatedRuntime.configDir,
    HOME: isolatedRuntime.homeDir,
    XDG_CACHE_HOME: isolatedRuntime.cacheDir,
    XDG_CONFIG_HOME: isolatedRuntime.configDir,
    XDG_DATA_HOME: isolatedRuntime.dataDir,
    XDG_STATE_HOME: isolatedRuntime.stateDir,
  }

  // Validate ANTHROPIC_CUSTOM_HEADERS if it exists - must be valid JSON
  // If invalid, delete it to prevent "Invalid header name" errors
  if (merged.ANTHROPIC_CUSTOM_HEADERS) {
    if (!isValidJson(merged.ANTHROPIC_CUSTOM_HEADERS)) {
      delete merged.ANTHROPIC_CUSTOM_HEADERS
    }
  }

  // Compatibility: use ANTHROPIC_AUTH_TOKEN as ANTHROPIC_API_KEY if no API key is set
  const authToken = merged.ANTHROPIC_AUTH_TOKEN
  if (authToken && !merged.ANTHROPIC_API_KEY) {
    merged.ANTHROPIC_API_KEY = authToken
  }

  // Running inside Claude terminal can break nested Claude invocations.
  delete merged.CLAUDECODE

  return merged
}

/**
 * Force Claude CLI debug output into a writable temp location.
 * This avoids crashes in restricted environments where ~/.claude/debug is not writable.
 */
export function getClaudeAgentDebugFilePath(): string | undefined {
  try {
    const dir = join(tmpdir(), 'game-theory-analyzer-claude-debug')
    mkdirSync(dir, { recursive: true })
    return join(dir, 'claude-agent.log')
  } catch {
    return undefined
  }
}
