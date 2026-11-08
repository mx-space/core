import { afterEach, describe, expect, it, vi } from 'vitest'

import { cleanCache, cleanRedis } from './aggregate'
import { createBackup } from './backups'
import { sendTestEmail } from './health'

describe('maintenance transport', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['/clean_catch', cleanCache],
    ['/clean_redis', cleanRedis],
    ['/health/email/test', sendTestEmail],
  ] as const)('posts authenticated action %s', async (path, action) => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))
    await action()
    expect(String(request.mock.calls[0][0])).toMatch(new RegExp(`${path}$`))
    expect(request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
  })

  it('posts backup creation and retains the downloaded bytes', async () => {
    const bytes = new Uint8Array([0, 255, 80, 75])
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(bytes, {
        headers: { 'content-type': 'application/octet-stream' },
      }),
    )
    const result = await createBackup()
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes)
    expect(request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
  })
})
