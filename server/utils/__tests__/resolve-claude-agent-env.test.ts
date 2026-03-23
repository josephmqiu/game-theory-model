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

  it('strips ambient Anthropic direct-auth env vars from process.env', async () => {
    process.env.PATH = '/usr/bin'
    process.env.HOME = '/mock-home'
    process.env[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV] = '/mock-user-data'
    process.env.ANTHROPIC_API_KEY = 'ambient-key'
    process.env.ANTHROPIC_AUTH_TOKEN = 'ambient-token'
    process.env.ANTHROPIC_CUSTOM_HEADERS = '{"x-test":"1"}'

    readFileSyncMock.mockImplementation(() => {
      throw new Error('missing settings')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    const env = buildClaudeAgentEnv()

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/mock-user-data/claude-runtime/home')
    expect(env.CLAUDE_CONFIG_DIR).toBe('/mock-user-data/claude-runtime/config')
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

  it('seeds isolated Claude auth state without copying path-heavy project data', async () => {
    process.env[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV] = '/mock-user-data'

    readFileSyncMock.mockImplementation((filePath: string) => {
      if (filePath === '/mock-home/.claude.json') {
        return JSON.stringify({
          anonymousId: 'anon-1',
          oauthAccount: { accountUuid: 'acct-1' },
          userID: 'user-1',
          customApiKeyResponses: { approved: ['hash-1'] },
          projects: { '/Users/tester/Desktop': { allowedTools: [] } },
          mcpServers: { pencil: { command: 'node' } },
          githubRepoPaths: ['/Volumes/team/repo'],
        })
      }
      throw new Error('missing file')
    })

    const { buildClaudeAgentEnv } = await import('../resolve-claude-agent-env')
    buildClaudeAgentEnv()

    expect(writeFileSyncMock).toHaveBeenCalledTimes(2)

    for (const call of writeFileSyncMock.mock.calls as Array<
      [string, string, string]
    >) {
      const [filePath, content] = call
      expect(filePath).toMatch(
        /\/mock-user-data\/claude-runtime\/(config|home)\/\.claude\.json$/,
      )
      const parsed = JSON.parse(content)
      expect(parsed).toEqual({
        anonymousId: 'anon-1',
        oauthAccount: { accountUuid: 'acct-1' },
        userID: 'user-1',
        customApiKeyResponses: { approved: ['hash-1'] },
      })
      expect(parsed.projects).toBeUndefined()
      expect(parsed.mcpServers).toBeUndefined()
      expect(parsed.githubRepoPaths).toBeUndefined()
    }
  })
})
