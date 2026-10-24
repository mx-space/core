/** Bound decoded bytes as well as Content-Length (which may describe compressed data). */
export async function readResponseBuffer(
  response: Response,
  limit: number,
): Promise<Buffer> {
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  try {
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error(`Response exceeds ${limit} bytes`)
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return Buffer.concat(chunks, size)
      size += value.byteLength
      if (size > limit) throw new Error(`Response exceeds ${limit} bytes`)
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
