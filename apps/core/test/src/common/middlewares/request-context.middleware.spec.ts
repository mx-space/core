import type { IncomingHttpHeaders, ServerResponse } from 'node:http'

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
  test('default chain: x-lang wins over cookie wins over accept-language', async () => {
    expect(
      await runWith({
        'x-lang': 'ja',
        cookie: 'NEXT_LOCALE=fr',
        'accept-language': 'zh-CN',
      }),
    ).toBe('ja')

    expect(
      await runWith({
        cookie: 'NEXT_LOCALE=fr',
        'accept-language': 'zh-CN',
      }),
    ).toBe('fr')

    expect(
      await runWith({
        'accept-language': 'zh-CN',
      }),
    ).toBe('zh')
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
    ).toBe('ja')
  })

  test('x-skip-translation value other than "1" does not trigger skip', async () => {
    expect(
      await runWith({
        'x-skip-translation': 'true',
        'accept-language': 'zh-CN',
      }),
    ).toBe('zh')
  })
})
