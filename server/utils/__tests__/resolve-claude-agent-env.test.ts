import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const readFileSyncMock = vi.fn()
const mkdirSyncMock = vi.fn()
let originalEnv: NodeJS.ProcessEnv

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
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
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('strips ambient Anthropic direct-auth env vars from process.env', async () => {
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/mock-home'
    process.env.ANTHROPIC_API_KEY = 'ambient-key'
    process.env.ANTHROPIC_AUTH_TOKEN = 'ambient-token'
    process.env.ANTHROPIC_CUSTOM_HEADERS = '{"x-test":"1"}'

    readFileSyncMock.mockImplementation(() => {
      throw new Error('missing settings')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    const env = buildClaudeAgentEnv()

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/mock-home')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
  })

  it('keeps explicit Claude settings env and strips CLAUDECODE', async () => {
    process.env.PATH = '/usr/bin'
    process.env.CLAUDECODE = '1'
    process.env.ANTHROPIC_API_KEY = 'ambient-key'

    readFileSyncMock.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/settings.json')) {
        return JSON.stringify({
          env: {
            ANTHROPIC_API_KEY: 'settings-key',
            ANTHROPIC_CUSTOM_HEADERS: { 'x-from-settings': '1' },
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
    expect(env.CLAUDECODE).toBeUndefined()
  })

  it('maps Anthropic auth token from Claude settings when no API key is set', async () => {
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
