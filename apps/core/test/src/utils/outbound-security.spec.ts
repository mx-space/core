import { afterEach, describe, expect, it, vi } from 'vitest'

import { safeFetch } from '~/modules/enrichment/providers/open-graph/safe-fetch'
import {
  isPrivateIp,
  parseAndValidateUrl,
} from '~/processors/agent-browser/url-guard'
import { readResponseBuffer } from '~/utils/http-response.util'
import { assertPublicHttpUrl, publicHttpDispatcher } from '~/utils/ssrf.util'

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))
vi.mock('undici', async (original) => ({
  ...(await original<typeof import('undici')>()),
  fetch: (...args: Parameters<typeof globalThis.fetch>) =>
    globalThis.fetch(...args),
}))
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }))
vi.mock('~/global/env.global', () => ({ isDev: false }))

const options = { timeoutMs: 30, maxBodyBytes: 8 }
afterEach(() => vi.unstubAllGlobals())

describe('outbound request security', () => {
  it.each([
    '::ffff:7f00:1',
    '0:0:0:0:0:ffff:a00:1',
    '::7f00:1',
    'fe80::1',
    'fc00::1',
  ])('blocks normalized private IPv6 %s', (ip) => {
    expect(isPrivateIp(ip, 6)).toBe(true)
    expect(() => parseAndValidateUrl(`http://[${ip}]/`)).toThrow()
  })
  it('retains the deadline after headers arrive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                init.signal.addEventListener(
                  'abort',
                  () => controller.error(new Error('deadline')),
                  { once: true },
                )
              },
            }),
            { headers: { 'content-type': 'text/html' } },
          ),
      ),
    )
    const result = safeFetch('https://8.8.8.8/', options)
    await expect(
      Promise.race([
        result,
        new Promise((resolve) => setTimeout(() => resolve('hung'), 100)),
      ]),
    ).rejects.toThrow('deadline')
  })
  it('uses a connection dispatcher and caps chunked bodies', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('0123456789', {
          headers: { 'content-type': 'text/html' },
        }),
    )
    vi.stubGlobal('fetch', fetch)
    expect(await safeFetch('https://8.8.8.8/', options)).toMatchObject({
      body: '01234567',
      truncated: true,
    })
    expect(fetch.mock.calls[0]?.[1]).toHaveProperty('dispatcher')
  })
})

describe('bounded binary responses', () => {
  it.each([undefined, '20'])(
    'rejects oversized bodies with content-length %s',
    async (length) => {
      let cancelled = false
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(20))
          },
          cancel() {
            cancelled = true
          },
        }),
        { headers: length ? { 'content-length': length } : {} },
      )
      await expect(readResponseBuffer(response, 8)).rejects.toThrow('exceeds')
      expect(cancelled).toBe(true)
    },
  )
  it('returns exact bytes for an allowed image', async () => {
    expect(
      await readResponseBuffer(new Response(new Uint8Array([1, 2, 3])), 3),
    ).toEqual(Buffer.from([1, 2, 3]))
  })
})
it('rejects a rebinding answer at socket connection time', async () => {
  lookupMock
    .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
    .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
  const url = await assertPublicHttpUrl('https://rebinding-security.test/')
  const { fetch } = await vi.importActual<typeof import('undici')>('undici')
  await expect(
    fetch(url, { dispatcher: publicHttpDispatcher }).catch((error) => {
      throw error.cause ?? error
    }),
  ).rejects.toThrow('Blocked outbound DNS address')
  expect(lookupMock).toHaveBeenCalledTimes(2)
})
