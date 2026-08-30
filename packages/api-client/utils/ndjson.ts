export class NdjsonParser {
  #rest = ''

  push(chunk: string): unknown[] {
    const text = `${this.#rest}${chunk}`
    const parts = text.split('\n')
    this.#rest = parts.pop() ?? ''
    const lines: unknown[] = []
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      lines.push(JSON.parse(trimmed))
    }
    return lines
  }

  flush(): unknown[] {
    const trimmed = this.#rest.trim()
    this.#rest = ''
    if (!trimmed) return []
    return [JSON.parse(trimmed)]
  }
}

export function parseNdjsonText(text: string): unknown[] {
  const parser = new NdjsonParser()
  const lines = parser.push(text)
  lines.push(...parser.flush())
  return lines
}

export async function* readNdjsonStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parser = new NdjsonParser()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of parser.push(decoder.decode(value, { stream: true }))) {
        yield line
      }
    }
    for (const line of parser.flush()) {
      yield line
    }
  } finally {
    reader.releaseLock()
  }
}
