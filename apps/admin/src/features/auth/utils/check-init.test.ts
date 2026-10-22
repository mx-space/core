import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkIsInit } from './check-init'

afterEach(() => {
  vi.unstubAllGlobals()
  window.injectData.INIT = null
})

describe('checkIsInit', () => {
  it('treats a closed init endpoint as initialized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    )
    await expect(checkIsInit()).resolves.toBe(true)
  })

  it('rejects on a server error instead of reporting a fresh install', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 502 })),
    )
    await expect(checkIsInit()).rejects.toThrow()
  })
})
