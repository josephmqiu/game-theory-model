import { describe, expect, it } from 'vitest'

import { createSampleCanonicalStore, createSampleAnalysisMeta } from '../test-support/sample-analysis'
import { analysisFileToStore, arrayToMap, mapToArray, storeToAnalysisFile } from './serialization'

describe('serialization utilities', () => {
  it('converts arrays to id-keyed maps', () => {
    const result = arrayToMap([
      { id: 'claim_1', label: 'first' },
      { id: 'claim_2', label: 'second' },
      { id: 'claim_3', label: 'third' },
    ])

    expect(Object.keys(result)).toHaveLength(3)
    expect(result.claim_2).toEqual({ id: 'claim_2', label: 'second' })
  })

  it('throws on duplicate ids during array-to-map conversion', () => {
    expect(() =>
      arrayToMap([
        { id: 'claim_1', label: 'first' },
        { id: 'claim_1', label: 'duplicate' },
      ]),
    ).toThrow(/claim_1/)
  })

  it('round-trips sorted arrays through map conversion', () => {
    const original = [
      { id: 'assumption_1', label: 'first' },
      { id: 'assumption_2', label: 'second' },
    ]

    expect(mapToArray(arrayToMap(original))).toEqual(original)
  })

  it('round-trips a populated canonical store through the analysis file shape', () => {
    const store = createSampleCanonicalStore()
    const file = storeToAnalysisFile(store, createSampleAnalysisMeta())
    const roundTripped = analysisFileToStore(file)

    expect(file.formalizations[0]).not.toHaveProperty('readiness_cache')
    expect(roundTripped.formalizations.formalization_1.readiness_cache).toBeUndefined()
    expect(roundTripped.games.game_1.stale_markers).toEqual(store.games.game_1.stale_markers)

    expect(roundTripped).toEqual({
      ...store,
      formalizations: {
        formalization_1: {
          ...store.formalizations.formalization_1,
          readiness_cache: undefined,
        },
      },
    })
  })
})
