import { beforeEach, describe, expect, it } from 'vitest'

import { createMemoryFs } from '../test-support/memory-fs'
import { createSampleCanonicalStore, createSampleAnalysisMeta } from '../test-support/sample-analysis'
import {
  resetEventPersistenceAdapter,
  setEventPersistenceAdapter,
} from '../engine/event-persistence'
import { saveAnalysisWithIo, loadAnalysisFileWithIo } from './file-io'
import { storeToAnalysisFile } from './serialization'

describe('file io pipeline', () => {
  beforeEach(() => {
    resetEventPersistenceAdapter()
  })

  it('returns recovery mode when the file cannot be read', async () => {
    const fs = createMemoryFs({})

    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('recovery')
    if (result.status !== 'recovery') {
      throw new Error('Expected recovery mode result.')
    }
    expect(result.stage).toBe('parse')
    expect(result.error.message).toMatch(/ENOENT/)
  })

  it('returns recovery mode when schema_version is missing', async () => {
    const fs = createMemoryFs({
      '/analysis.gta.json': JSON.stringify({ name: 'Missing version' }),
    })

    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('recovery')
    if (result.status !== 'recovery') {
      throw new Error('Expected recovery mode result.')
    }
    expect(result.stage).toBe('parse')
    expect(result.error.message).toMatch(/schema_version/)
  })

  it('returns recovery mode when an array contains duplicate ids', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const duplicateClaims = {
      ...file,
      claims: [file.claims[0], { ...file.claims[0] }],
    }
    const fs = createMemoryFs({
      '/analysis.gta.json': JSON.stringify(duplicateClaims),
    })

    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('recovery')
    if (result.status !== 'recovery') {
      throw new Error('Expected recovery mode result.')
    }
    expect(result.stage).toBe('structural')
    expect(result.error.structural_issues?.[0]?.kind).toBe('duplicate_id')
  })

  it('catches cross-type id collisions during structural checks', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const colliding = {
      ...file,
      assumptions: [
        {
          ...file.assumptions[0],
          id: file.claims[0].id,
        },
      ],
    }
    const fs = createMemoryFs({
      '/analysis.gta.json': JSON.stringify(colliding),
    })

    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('recovery')
    if (result.status !== 'recovery') {
      throw new Error('Expected recovery mode result.')
    }
    expect(result.stage).toBe('structural')
    expect(result.error.structural_issues?.[0]).toMatchObject({
      kind: 'cross_type_collision',
      id: 'claim_1',
    })
  })

  it('preserves stale markers and drops readiness cache on full save/load round-trip', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const fs = createMemoryFs({})

    await saveAnalysisWithIo('/analysis.gta.json', file, fs)
    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('success')
    if (result.status !== 'success') {
      throw new Error('Expected successful load result.')
    }

    expect(result.store.games.game_1.stale_markers).toEqual(
      createSampleCanonicalStore().games.game_1.stale_markers,
    )
    expect(result.store.formalizations.formalization_1.readiness_cache).toBeUndefined()
    expect(result.event_log.cursor).toBe(0)
  })

  it('falls back to persisted revision 0 when revision lookup fails', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const fs = createMemoryFs({
      '/analysis.gta.json': JSON.stringify(file),
    })

    setEventPersistenceAdapter({
      persistEventSync() {},
      queryEventsSync() {
        return []
      },
      getCanonicalRevisionSync() {
        throw new Error('revision store unavailable')
      },
      incrementRevisionSync() {
        return 0
      },
      reset() {},
    })

    const result = await loadAnalysisFileWithIo('/analysis.gta.json', fs)

    expect(result.status).toBe('success')
    if (result.status !== 'success') {
      throw new Error('Expected successful load result.')
    }
    expect(result.event_log.persisted_revision).toBe(0)
    expect(result.integrity.warnings?.some((warning) => warning.includes('defaulted to revision 0'))).toBe(true)
  })

  it('writes a temp file, verifies it, creates a backup, and renames into place', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const fs = createMemoryFs({
      '/analysis.gta.json': '{"existing":true}',
    })

    await saveAnalysisWithIo('/analysis.gta.json', file, fs)

    expect(fs.files.get('/analysis.gta.json.backup')).toBe('{"existing":true}')
    expect(fs.files.get('/analysis.gta.json')).toContain('"schema_version": 1')
    expect([...fs.files.keys()].some((path) => path.includes('.tmp.'))).toBe(false)
  })

  it('leaves the original file untouched when temp verification fails', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const fs = createMemoryFs(
      {
        '/analysis.gta.json': '{"existing":true}',
      },
      {
        onReadFile(path, contents) {
          if (path.includes('.tmp.')) {
            return '{"schema_version":1,"name":""}'
          }

          return contents
        },
      },
    )

    await expect(saveAnalysisWithIo('/analysis.gta.json', file, fs)).rejects.toThrow(
      /verification/,
    )

    expect(fs.files.get('/analysis.gta.json')).toBe('{"existing":true}')
    expect(fs.files.has('/analysis.gta.json.backup')).toBe(false)
    expect([...fs.files.keys()].some((path) => path.includes('.tmp.'))).toBe(false)
  })

  it('rejects save when the written file fails structural checks', async () => {
    const file = storeToAnalysisFile(createSampleCanonicalStore(), createSampleAnalysisMeta())
    const structurallyInvalid = {
      ...file,
      assumptions: [
        {
          ...file.assumptions[0],
          id: file.claims[0].id,
        },
      ],
    }
    const fs = createMemoryFs({
      '/analysis.gta.json': '{"existing":true}',
    })

    await expect(
      saveAnalysisWithIo('/analysis.gta.json', structurallyInvalid, fs),
    ).rejects.toThrow(/structural checks/i)

    expect(fs.files.get('/analysis.gta.json')).toBe('{"existing":true}')
    expect(fs.files.has('/analysis.gta.json.backup')).toBe(false)
    expect([...fs.files.keys()].some((path) => path.includes('.tmp.'))).toBe(false)
  })

  it('rejects save when the written file fails integrity checks', async () => {
    const store = createSampleCanonicalStore()
    store.scenarios.scenario_1.path = ['game_edge_missing']

    const fs = createMemoryFs({
      '/analysis.gta.json': '{"existing":true}',
    })

    await expect(
      saveAnalysisWithIo(
        '/analysis.gta.json',
        storeToAnalysisFile(store, createSampleAnalysisMeta()),
        fs,
      ),
    ).rejects.toThrow(/integrity checks/i)

    expect(fs.files.get('/analysis.gta.json')).toBe('{"existing":true}')
    expect(fs.files.has('/analysis.gta.json.backup')).toBe(false)
    expect([...fs.files.keys()].some((path) => path.includes('.tmp.'))).toBe(false)
  })
})
