import type { ServerResponse } from 'node:http'
import { RequestContext } from '~/common/contexts/request.context'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

const wait = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('RequestContext', () => {
  test('keeps context through the full async request flow', async () => {
    const user = { id: 'user-1' }
    const request = {
      user,
      isAuthenticated: true,
      isGuest: false,
      readerId: 'reader-1',
    } as BizIncomingMessage
    const response = {} as ServerResponse
    const context = new RequestContext(request, response)

    await RequestContext.run(context, async () => {
      expect(RequestContext.currentRequestContext()).toBe(context)
      expect(RequestContext.currentRequest()).toBe(request)
      expect(RequestContext.currentUser()).toBe(user)
      expect(RequestContext.currentIsAuthenticated()).toBe(true)

      await Promise.resolve()
      expect(RequestContext.currentRequestContext()).toBe(context)

      await wait(0)
      expect(RequestContext.currentRequestContext()).toBe(context)

      await new Promise<void>((resolve) => process.nextTick(resolve))
      expect(RequestContext.currentRequestContext()).toBe(context)
    })

    expect(RequestContext.currentRequestContext()).toBeNull()
  })

  test('isolates concurrent request contexts', async () => {
    const makeContext = (readerId: string) => {
      const request = {
        isAuthenticated: true,
        isGuest: false,
        readerId,
      } as BizIncomingMessage
      const response = {} as ServerResponse
      return new RequestContext(request, response)
    }

    const contextA = makeContext('reader-a')
    const contextB = makeContext('reader-b')

    const run = (context: RequestContext, delay: number) =>
      RequestContext.run(context, async () => {
        await wait(delay)
        return RequestContext.currentRequest()?.readerId
      })

    const [readerA, readerB] = await Promise.all([
      run(contextA, 20),
      run(contextB, 5),
    ])

    expect(readerA).toBe('reader-a')
    expect(readerB).toBe('reader-b')
  })
})
