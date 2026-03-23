import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV } from '../../../src/lib/runtime-state-paths'

const readFileSyncMock = vi.fn()
const mkdirSyncMock = vi.fn()
const writeFileSyncMock = vi.fn()
let originalEnv: NodeJS.ProcessEnv

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
}))

vi.mock('node:os', () => ({
  homedir: () => '/mock-home',
  tmpdir: () => '/tmp',
}))

describe('buildClaudeAgentEnv', () => {
  beforeEach(() => {
    originalEnv = { ...process.env }
    readFileSyncMock.mockReset()
    mkdirSyncMock.mockReset()
    writeFileSyncMock.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('preserves the real HOME and strips direct-auth config overrides', async () => {
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/mock-home'
    process.env[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV] = '/mock-user-data'
    process.env.ANTHROPIC_API_KEY = 'ambient-key'
    process.env.ANTHROPIC_AUTH_TOKEN = 'ambient-token'
    process.env.ANTHROPIC_CUSTOM_HEADERS = '{"x-test":"1"}'
    process.env.CLAUDE_CONFIG_DIR = '/ambient-config'
    process.env.XDG_CONFIG_HOME = '/ambient-xdg-config'

    readFileSyncMock.mockImplementation(() => {
      throw new Error('missing settings')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    const env = buildClaudeAgentEnv()

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/mock-home')
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(env.XDG_CONFIG_HOME).toBeUndefined()
    expect(env.XDG_CACHE_HOME).toBe('/mock-user-data/claude-runtime/cache')
    expect(env.XDG_DATA_HOME).toBe('/mock-user-data/claude-runtime/data')
    expect(env.XDG_STATE_HOME).toBe('/mock-user-data/claude-runtime/state')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()

    expect(mkdirSyncMock).toHaveBeenCalledTimes(3)
    expect(mkdirSyncMock.mock.calls).toEqual([
      ['/mock-user-data/claude-runtime/cache', { recursive: true }],
      ['/mock-user-data/claude-runtime/data', { recursive: true }],
      ['/mock-user-data/claude-runtime/state', { recursive: true }],
    ])
    expect(writeFileSyncMock).not.toHaveBeenCalled()
  })

  it('keeps explicit Claude settings env but ignores auth-session location keys', async () => {
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/mock-home'
    process.env[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV] = '/mock-user-data'
    process.env.CLAUDECODE = '1'
    process.env.ANTHROPIC_API_KEY = 'ambient-key'

    readFileSyncMock.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/settings.json')) {
        return JSON.stringify({
          env: {
            ANTHROPIC_API_KEY: 'settings-key',
            ANTHROPIC_CUSTOM_HEADERS: { 'x-from-settings': '1' },
            HOME: '/bad-settings-home',
            CLAUDE_CONFIG_DIR: '/bad-settings-config',
            XDG_CONFIG_HOME: '/bad-settings-xdg-config',
            CLAUDECODE: '1',
          },
        })
      }
      throw new Error('missing settings.local.json')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    const env = buildClaudeAgentEnv()

    expect(env.ANTHROPIC_API_KEY).toBe('settings-key')
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBe('{"x-from-settings":"1"}')
    expect(env.HOME).toBe('/mock-home')
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(env.XDG_CONFIG_HOME).toBeUndefined()
    expect(env.XDG_CACHE_HOME).toBe('/mock-user-data/claude-runtime/cache')
    expect(env.XDG_DATA_HOME).toBe('/mock-user-data/claude-runtime/data')
    expect(env.XDG_STATE_HOME).toBe('/mock-user-data/claude-runtime/state')
    expect(env.CLAUDECODE).toBeUndefined()
  })

  it('maps Anthropic auth token from Claude settings when no API key is set', async () => {
    process.env[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV] = '/mock-user-data'

    readFileSyncMock.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/settings.json')) {
        return JSON.stringify({
          env: {
            ANTHROPIC_AUTH_TOKEN: 'settings-token',
          },
        })
      }
      throw new Error('missing settings.local.json')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    const env = buildClaudeAgentEnv()

    expect(env.ANTHROPIC_API_KEY).toBe('settings-token')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('settings-token')
  })
})
