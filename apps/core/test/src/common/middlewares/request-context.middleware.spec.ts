import type { IncomingHttpHeaders, ServerResponse } from 'node:http'

import { OperationContext } from '~/common/contexts/operation.context'
import { RequestContext } from '~/common/contexts/request.context'
import { RequestContextMiddleware } from '~/common/middlewares/request-context.middleware'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

const buildReq = (headers: IncomingHttpHeaders): BizIncomingMessage =>
  ({ headers }) as unknown as BizIncomingMessage

const buildRes = () => ({}) as ServerResponse

const runWith = async (headers: IncomingHttpHeaders) => {
  const middleware = new RequestContextMiddleware()
  let captured: string | undefined
  await new Promise<void>((resolve) => {
    middleware.use(buildReq(headers), buildRes(), () => {
      captured = RequestContext.currentLang()
      resolve()
    })
  })
  return captured
}

describe('RequestContextMiddleware lang resolution', () => {
  test('provides one isolated operation id per request', async () => {
    const middleware = new RequestContextMiddleware()
    const capture = () =>
      new Promise<string | undefined>((resolve) => {
        middleware.use(buildReq({}), buildRes(), async () => {
          await Promise.resolve()
          resolve(OperationContext.currentId())
        })
      })

    const [first, second] = await Promise.all([capture(), capture()])

    expect(first).toMatch(/^request:/)
    expect(second).toMatch(/^request:/)
    expect(first).not.toBe(second)
  })

  test('default chain: x-lang wins over cookie wins over accept-language', async () => {
    expect(
      await runWith({
        'x-lang': 'ja',
        cookie: 'NEXT_LOCALE=fr',
        'accept-language': 'zh-CN',
      }),
    ).toBe('ja-JP')

    expect(
      await runWith({
        cookie: 'NEXT_LOCALE=fr',
        'accept-language': 'zh-CN',
      }),
    ).toBe('fr-FR')

    expect(
      await runWith({
        'accept-language': 'zh-CN',
      }),
    ).toBe('zh-CN')
  })

  test('x-skip-translation: 1 ignores cookie and accept-language', async () => {
    expect(
      await runWith({
        'x-skip-translation': '1',
        cookie: 'NEXT_LOCALE=fr',
        'accept-language': 'zh-CN',
      }),
    ).toBeUndefined()
  })

  test('x-skip-translation: 1 still honors explicit x-lang', async () => {
    expect(
      await runWith({
        'x-skip-translation': '1',
        'x-lang': 'ja',
        'accept-language': 'zh-CN',
      }),
    ).toBe('ja-JP')
  })

  test('x-skip-translation value other than "1" does not trigger skip', async () => {
    expect(
      await runWith({
        'x-skip-translation': 'true',
        'accept-language': 'zh-CN',
      }),
    ).toBe('zh-CN')
  })

  test('keeps Traditional Chinese distinct from Simplified', async () => {
    expect(await runWith({ 'x-lang': 'zh-TW' })).toBe('zh-TW')
    expect(await runWith({ 'x-lang': 'zh_TW' })).toBe('zh-TW')
    expect(await runWith({ cookie: 'NEXT_LOCALE=zh-TW' })).toBe('zh-TW')
    expect(await runWith({ 'accept-language': 'zh-HK,zh;q=0.9' })).toBe('zh-HK')
  })

  test('accept-language skips invalid tags', async () => {
    expect(await runWith({ 'accept-language': 'jp,en;q=0.8' })).toBe('en-US')
  })
})
