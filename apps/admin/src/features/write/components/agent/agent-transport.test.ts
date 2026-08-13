import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAdminAgentTransport } from './agent-transport'

describe('createAdminAgentTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes the Admin-owned session id in the chat request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('data: {"type":"done"}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
        status: 200,
      }),
    )
    const transport = createAdminAgentTransport('openrouter')

    for await (const _event of transport({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'openai/gpt-4o-mini',
      sessionId: 'admin-session',
    })) {
      // Consume the response so the request completes.
    }

    const [, init] = fetchSpy.mock.calls[0] ?? []
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({ sessionId: 'admin-session' }),
    )
  })
})
