import { afterEach, describe, expect, it, vi } from 'vitest'

import { axiosAdaptor } from '~/adaptors/axios'
import { allControllers } from '~/controllers'
import { createClient } from '~/core'

describe('preparation transport', () => {
  const client = createClient(axiosAdaptor)('https://example.com/api/v3')
  client.injectControllers(allControllers)
  afterEach(() => vi.restoreAllMocks())

  it('uses POST for attitudes with the existing query and response', async () => {
    vi.spyOn(axiosAdaptor, 'get').mockRejectedValue(
      new Error('GET must not execute an attitude'),
    )
    const request = vi
      .spyOn(axiosAdaptor, 'post')
      .mockResolvedValue({ data: { data: { code: 1 } } })
    expect(await client.recently.attitude('123', 1)).toEqual({ code: 1 })
    expect(request.mock.calls[0][0]).toBe(
      'https://example.com/api/v3/recently/attitude/123',
    )
    expect(request.mock.calls[0][1]?.params).toEqual({ attitude: 1 })
  })

  it.each([
    [1, 'asc'],
    [-1, 'desc'],
  ] as const)(
    'normalizes %s sorting without changing caller input',
    async (input, expected) => {
      const request = vi
        .spyOn(axiosAdaptor, 'get')
        .mockResolvedValue({ data: { data: [] } })
      const sort = Object.freeze({ sortBy: 'created', sortOrder: input })
      await client.link.getAllPaginated(1, 10, sort)
      const url = new URL(request.mock.calls[0][0])
      expect(url.searchParams.get('sortOrder')).toBe(expected)
      expect(sort.sortOrder).toBe(input)
    },
  )

  it('authenticates the retained token check signature using a header', async () => {
    const request = vi
      .spyOn(axiosAdaptor, 'get')
      .mockResolvedValue({ data: { data: { ok: 1 } } })
    await client.owner.checkTokenValid(' Bearer secret-token ')
    expect(request.mock.calls[0][0]).not.toContain('token')
    expect(request.mock.calls[0][1]?.params).toBeUndefined()
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
    })
  })

  it('normalizes article list sorting at the adapter boundary', async () => {
    const request = vi
      .spyOn(axiosAdaptor, 'get')
      .mockResolvedValue({ data: { data: [] } })
    await client.post.getList(1, 10, { sortOrder: -1 })
    expect(
      new URL(request.mock.calls[0][0]).searchParams.get('sortOrder'),
    ).toBe('desc')
  })

  it('keeps the legacy summary signature without leaking its token in URLs', async () => {
    const request = vi
      .spyOn(axiosAdaptor, 'post')
      .mockResolvedValue({ data: { data: {} } })
    await client.ai.generateSummary('123', 'zh-CN', 'secret-token')
    expect(request.mock.calls[0][0]).not.toContain('token')
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
    })
  })
})
