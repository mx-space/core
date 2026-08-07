import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ttsLangLockKey,
  withTtsLangLock,
} from '~/modules/ai/ai-tts/tts-lang-lock'

function createRedis() {
  const store = new Map<string, string>()
  return {
    store,
    set: vi.fn(async (key: string, value: string) => {
      if (store.has(key)) return null
      store.set(key, value)
      return 'OK'
    }),
    eval: vi.fn(
      async (script: string, _keys: number, key: string, token: string) => {
        if (store.get(key) !== token) return 0
        if (script.includes('del')) store.delete(key)
        return 1
      },
    ),
  }
}

describe('withTtsLangLock', () => {
  let redis: ReturnType<typeof createRedis>

  beforeEach(() => {
    redis = createRedis()
  })

  it('runs the body and releases the lock', async () => {
    const result = await withTtsLangLock(
      redis as never,
      '1',
      'zh',
      async () => 'done',
    )

    expect(result).toBe('done')
    expect(redis.store.size).toBe(0)
  })

  it('releases the lock when the body throws', async () => {
    await expect(
      withTtsLangLock(redis as never, '1', 'zh', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(redis.store.size).toBe(0)
  })

  it('returns null without running the body when the lock is held', async () => {
    redis.store.set(ttsLangLockKey('1', 'zh'), 'someone-else')
    const body = vi.fn()

    const result = await withTtsLangLock(
      redis as never,
      '1',
      'zh',
      body as never,
    )

    expect(result).toBeNull()
    expect(body).not.toHaveBeenCalled()
    expect(redis.store.get(ttsLangLockKey('1', 'zh'))).toBe('someone-else')
  })

  it('never releases a lock it no longer owns', async () => {
    await withTtsLangLock(redis as never, '1', 'zh', async () => {
      redis.store.set(ttsLangLockKey('1', 'zh'), 'a-later-holder')
    })

    expect(redis.store.get(ttsLangLockKey('1', 'zh'))).toBe('a-later-holder')
  })

  it('keeps the body result when the release fails', async () => {
    const onLockError = vi.fn()
    redis.eval.mockRejectedValueOnce(new Error('redis blip'))

    const result = await withTtsLangLock(
      redis as never,
      '1',
      'zh',
      async () => 'done',
      onLockError,
    )

    expect(result).toBe('done')
    expect(onLockError).toHaveBeenCalledWith(expect.any(Error), 'release')
  })

  it('keeps the body error when the release fails', async () => {
    redis.eval.mockRejectedValueOnce(new Error('redis blip'))

    await expect(
      withTtsLangLock(
        redis as never,
        '1',
        'zh',
        async () => {
          throw new Error('boom')
        },
        vi.fn(),
      ),
    ).rejects.toThrow('boom')
  })

  it('clears the renewal interval so the process is not held open', async () => {
    vi.useFakeTimers()
    try {
      await withTtsLangLock(redis as never, '1', 'zh', async () => 'done')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renews under the token and reports a renewal failure instead of rejecting', async () => {
    vi.useFakeTimers()
    const onLockError = vi.fn()
    try {
      const run = withTtsLangLock(
        redis as never,
        '1',
        'zh',
        async () => {
          redis.eval.mockRejectedValueOnce(new Error('redis blip'))
          await vi.advanceTimersByTimeAsync(120_000)
          return 'done'
        },
        onLockError,
      )

      await expect(run).resolves.toBe('done')
      expect(onLockError).toHaveBeenCalledWith(expect.any(Error), 'renew')
    } finally {
      vi.useRealTimers()
    }
  })
})
