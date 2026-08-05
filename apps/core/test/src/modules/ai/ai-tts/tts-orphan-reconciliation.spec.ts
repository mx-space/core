import { describe, expect, it, vi } from 'vitest'

import { reconcileTtsOrphans } from '~/modules/ai/ai-tts/tts-orphan-reconciliation'

const HOUR = 60 * 60 * 1000

describe('reconcileTtsOrphans', () => {
  it('skips a candidate whose storage key has a row', async () => {
    const deleteObject = vi.fn()
    const now = Date.now()

    const result = await reconcileTtsOrphans({
      candidates: [
        {
          storageBackend: 's3',
          storageKey: 'tts/1/zh/a.mp3',
          lastModified: new Date(now - 2 * HOUR),
        },
      ],
      knownStorageKeys: new Set(['tts/1/zh/a.mp3']),
      minAgeMs: HOUR,
      now,
      deleteObject,
      onDeleteFailure: vi.fn(),
    })

    expect(result).toEqual({ deleted: 0 })
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('skips a candidate younger than the age floor even without a row', async () => {
    const deleteObject = vi.fn()
    const now = Date.now()

    const result = await reconcileTtsOrphans({
      candidates: [
        {
          storageBackend: 's3',
          storageKey: 'tts/1/zh/fresh.mp3',
          lastModified: new Date(now - 1000),
        },
      ],
      knownStorageKeys: new Set(),
      minAgeMs: HOUR,
      now,
      deleteObject,
      onDeleteFailure: vi.fn(),
    })

    expect(result).toEqual({ deleted: 0 })
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('deletes and counts an orphan past the age floor with no row', async () => {
    const deleteObject = vi.fn(async () => {})
    const now = Date.now()

    const result = await reconcileTtsOrphans({
      candidates: [
        {
          storageBackend: 'local',
          storageKey: 'tts/1/zh/orphan.mp3',
          lastModified: new Date(now - 2 * HOUR),
        },
      ],
      knownStorageKeys: new Set(),
      minAgeMs: HOUR,
      now,
      deleteObject,
      onDeleteFailure: vi.fn(),
    })

    expect(result).toEqual({ deleted: 1 })
    expect(deleteObject).toHaveBeenCalledWith('local', 'tts/1/zh/orphan.mp3')
  })

  it('reports a delete failure through the callback and keeps going', async () => {
    const onDeleteFailure = vi.fn()
    const deleteObject = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)
    const now = Date.now()

    const result = await reconcileTtsOrphans({
      candidates: [
        {
          storageBackend: 's3',
          storageKey: 'tts/1/zh/a.mp3',
          lastModified: new Date(now - 2 * HOUR),
        },
        {
          storageBackend: 's3',
          storageKey: 'tts/1/zh/b.mp3',
          lastModified: new Date(now - 2 * HOUR),
        },
      ],
      knownStorageKeys: new Set(),
      minAgeMs: HOUR,
      now,
      deleteObject,
      onDeleteFailure,
    })

    expect(result).toEqual({ deleted: 1 })
    expect(onDeleteFailure).toHaveBeenCalledTimes(1)
    expect(onDeleteFailure.mock.calls[0][0]).toMatchObject({
      storageKey: 'tts/1/zh/a.mp3',
    })
  })
})
