import { beforeEach, describe, expect, it } from 'vitest'
import type { ProviderModelsResponse } from '~/api/ai'
import type { SelectedAgentModel } from './types'

import {
  filterRecentModelsWithin,
  readRecentModels,
  rememberRecentModel,
  toModelValue,
  writeRecentModels,
} from './model-recents'

const STORAGE_KEY = 'agent-chat:recent-models'

function model(providerId: string, modelId: string): SelectedAgentModel {
  return { providerId, modelId, providerType: 'claude' }
}

beforeEach(() => {
  localStorage.clear()
})

describe('toModelValue', () => {
  it('joins providerId and modelId with ::', () => {
    expect(toModelValue({ providerId: 'p1', modelId: 'm1' })).toBe('p1::m1')
  })
})

describe('rememberRecentModel', () => {
  it('prepends the model as most-recent', () => {
    const result = rememberRecentModel(model('p1', 'm1'), [model('p2', 'm2')])
    expect(result.map(toModelValue)).toEqual(['p1::m1', 'p2::m2'])
  })

  it('dedupes the same model by providerId+modelId', () => {
    const current = [model('p1', 'm1'), model('p2', 'm2')]
    const result = rememberRecentModel(model('p2', 'm2'), current)
    expect(result.map(toModelValue)).toEqual(['p2::m2', 'p1::m1'])
    expect(result).toHaveLength(2)
  })

  it('caps at 5 most-recent entries', () => {
    let current: SelectedAgentModel[] = []
    for (let i = 0; i < 8; i++) {
      current = rememberRecentModel(model('p', `m${i}`), current)
    }
    expect(current).toHaveLength(5)
    expect(current.map((m) => m.modelId)).toEqual([
      'm7',
      'm6',
      'm5',
      'm4',
      'm3',
    ])
  })
})

describe('filterRecentModelsWithin', () => {
  const groups: ProviderModelsResponse[] = [
    {
      providerId: 'p1',
      providerName: 'P1',
      providerType: 'claude',
      models: [{ id: 'm1', name: 'M1' }],
    },
  ]

  it('keeps models present in the provider groups', () => {
    expect(filterRecentModelsWithin([model('p1', 'm1')], groups)).toEqual([
      model('p1', 'm1'),
    ])
  })

  it('drops models whose provider is missing', () => {
    expect(filterRecentModelsWithin([model('px', 'm1')], groups)).toEqual([])
  })

  it('drops models whose modelId is missing within the provider', () => {
    expect(filterRecentModelsWithin([model('p1', 'mx')], groups)).toEqual([])
  })
})

describe('readRecentModels / writeRecentModels', () => {
  it('round-trips through localStorage', () => {
    const models = [model('p1', 'm1'), model('p2', 'm2')]
    writeRecentModels(models)
    expect(readRecentModels()).toEqual(models)
  })

  it('removes the storage key when writing an empty list', () => {
    writeRecentModels([model('p1', 'm1')])
    writeRecentModels([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns [] when storage is missing', () => {
    expect(readRecentModels()).toEqual([])
  })

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readRecentModels()).toEqual([])
  })

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(readRecentModels()).toEqual([])
  })

  it('filters out invalid entries when reading', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        model('p1', 'm1'),
        { providerId: 'p2' },
        { providerId: 'p3', modelId: 'm3', providerType: '' },
      ]),
    )
    expect(readRecentModels()).toEqual([model('p1', 'm1')])
  })
})
