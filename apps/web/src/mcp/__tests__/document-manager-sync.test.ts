import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readSyncUrlFromPortFiles } from '../document-manager'

const TMP_DIR = join(tmpdir(), 'game-theory-analyzer-sync-tests')

describe('document-manager sync discovery', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(TMP_DIR, { recursive: true, force: true })
  })

  it('uses the preferred port file when it points to a live process', async () => {
    const preferred = join(TMP_DIR, 'preferred.port')
    await writeFile(
      preferred,
      JSON.stringify({ port: 4100, pid: 1111, timestamp: Date.now() }),
      'utf-8',
    )

    vi.spyOn(process, 'kill').mockImplementation(() => true)

    await expect(readSyncUrlFromPortFiles([preferred])).resolves.toBe(
      'http://127.0.0.1:4100',
    )
  })

  it('falls back to the legacy port file when the preferred path is missing', async () => {
    const legacy = join(TMP_DIR, 'legacy.port')
    await writeFile(
      legacy,
      JSON.stringify({ port: 4200, pid: 2222, timestamp: Date.now() }),
      'utf-8',
    )

    vi.spyOn(process, 'kill').mockImplementation(() => true)

    await expect(
      readSyncUrlFromPortFiles([join(TMP_DIR, 'missing.port'), legacy]),
    ).resolves.toBe('http://127.0.0.1:4200')
  })

  it('skips a stale preferred port file and uses the next live candidate', async () => {
    const preferred = join(TMP_DIR, 'preferred-stale.port')
    const legacy = join(TMP_DIR, 'legacy-live.port')
    await writeFile(
      preferred,
      JSON.stringify({ port: 4300, pid: 3333, timestamp: Date.now() }),
      'utf-8',
    )
    await writeFile(
      legacy,
      JSON.stringify({ port: 4301, pid: 4444, timestamp: Date.now() }),
      'utf-8',
    )

    vi.spyOn(process, 'kill').mockImplementation((pid) => {
      if (pid === 3333) {
        const error = new Error('stale process') as NodeJS.ErrnoException
        error.code = 'ESRCH'
        throw error
      }
      return true
    })

    await expect(readSyncUrlFromPortFiles([preferred, legacy])).resolves.toBe(
      'http://127.0.0.1:4301',
    )
  })
})
