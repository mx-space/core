import { describe, expect, it, vi } from 'vitest'

import { resolveNoteId } from '../../../src/commands/note/resolve'

function mockClient(responses: Record<string, unknown>) {
  return {
    request: vi.fn(async (path: string) => {
      if (!(path in responses)) {
        throw new Error(`unexpected request: ${path}`)
      }
      return { ok: true, status: 200, data: responses[path] }
    }),
  } as any
}

describe('note id resolution', () => {
  it('returns snowflake ids unchanged without a request', async () => {
    const client = mockClient({})

    await expect(resolveNoteId(client, '123456789012345')).resolves.toBe(
      '123456789012345',
    )
    expect(client.request).not.toHaveBeenCalled()
  })

  it('resolves numeric nid through /notes/nid/:nid envelope', async () => {
    const client = mockClient({
      '/notes/nid/42': { data: { id: 'note-1', nid: 42 } },
    })

    await expect(resolveNoteId(client, '42')).resolves.toBe('note-1')
  })

  it('accepts the flat shape (no nested data) returned by some routes', async () => {
    const client = mockClient({
      '/notes/nid/7': { id: 'note-flat' },
    })

    await expect(resolveNoteId(client, '7')).resolves.toBe('note-flat')
  })

  it('rejects non-snowflake non-numeric input with a validation error', async () => {
    const client = mockClient({})

    await expect(resolveNoteId(client, 'hello-world')).rejects.toThrow(
      /invalid note reference: hello-world/,
    )
    expect(client.request).not.toHaveBeenCalled()
  })

  it('throws when the nid lookup returns no id', async () => {
    const client = mockClient({
      '/notes/nid/99': { data: {} },
    })

    await expect(resolveNoteId(client, '99')).rejects.toThrow(
      /note not found: 99/,
    )
  })
})
