import { describe, expect, it } from 'vitest'

import { NdjsonParser, parseNdjsonText, readNdjsonStream } from '~/utils/ndjson'

describe('NdjsonParser', () => {
  it('yields complete lines and keeps a trailing partial', () => {
    const parser = new NdjsonParser()
    expect(parser.push('{"id":"a"}\n{"id":')).toEqual([{ id: 'a' }])
    expect(parser.push('"b"}\n')).toEqual([{ id: 'b' }])
    expect(parser.flush()).toEqual([])
  })

  it('flushes a final line without a trailing newline', () => {
    const parser = new NdjsonParser()
    expect(parser.push('{"id":"a"}')).toEqual([])
    expect(parser.flush()).toEqual([{ id: 'a' }])
  })
})

describe('parseNdjsonText', () => {
  it('skips blank lines', () => {
    expect(parseNdjsonText('{"a":1}\n\n{"b":2}\n')).toEqual([
      { a: 1 },
      { b: 2 },
    ])
  })
})

describe('readNdjsonStream', () => {
  it('reassembles lines split across chunks', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"id":"a"}\n{"id":'))
        controller.enqueue(encoder.encode('"b"}\n'))
        controller.close()
      },
    })

    const lines: unknown[] = []
    for await (const line of readNdjsonStream(body)) {
      lines.push(line)
    }
    expect(lines).toEqual([{ id: 'a' }, { id: 'b' }])
  })
})
