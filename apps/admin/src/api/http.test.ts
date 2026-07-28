import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiRequestError, getJson } from './http'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Error',
    json: async () => body,
  } as Response
}

describe('requestJson error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws an ApiRequestError carrying the error envelope code, not just the message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'AI_NOT_ENABLED',
            details: { provider: 'missing' },
            message: 'No AI provider configured',
          },
        },
        400,
      ),
    )

    const error = await getJson('/ai/image/draft-prompt').catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect((error as ApiRequestError).code).toBe('AI_NOT_ENABLED')
    expect((error as ApiRequestError).details).toEqual({ provider: 'missing' })
    expect((error as ApiRequestError).message).toBe('No AI provider configured')
    expect((error as ApiRequestError).status).toBe(400)
  })

  it('leaves code undefined when the error envelope has none', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: { message: 'boom' } }, 500),
    )

    const error = await getJson('/whatever').catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect((error as ApiRequestError).code).toBeUndefined()
  })
})
