import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  type AuthorCodec,
  startAuthorServer,
} from '../../../src/cli/author/server'
import { openAuthorDocument } from '../../../src/cli/author/document'
import { nodeAuthorFs } from '../../../src/cli/author/fs'

const fakeCodec: AuthorCodec = {
  litexmlToLexical: (xml) => ({ xml }),
  lexicalToLitexml: (lexical) => {
    if (
      typeof lexical !== 'object' ||
      lexical === null ||
      !('xml' in lexical) ||
      typeof lexical.xml !== 'string'
    ) {
      throw new Error('bad lexical')
    }
    return lexical.xml
  },
}

const rawRequest = (opts: {
  port: number
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string
}): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: opts.port,
        method: opts.method ?? 'GET',
        path: opts.url ?? '/',
        headers: opts.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })

describe('startAuthorServer', () => {
  const closers: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (closers.length > 0) {
      const close = closers.pop()
      await close?.()
    }
  })

  const logs: string[] = []
  const boot = async (source: string, fileName = 'article.xml') => {
    logs.length = 0
    const dir = await mkdtemp(join(tmpdir(), 'mxs-author-'))
    const spaDir = join(dir, 'spa')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(spaDir)
    await writeFile(join(spaDir, 'index.html'), '<html>author</html>')
    const filePath = join(dir, fileName)
    await writeFile(filePath, source)
    const doc = openAuthorDocument(filePath, source)
    const server = await startAuthorServer({
      doc,
      spaDir,
      codec: fakeCodec,
      fs: nodeAuthorFs,
      port: 0,
      log: (line) => logs.push(line),
    })
    closers.push(server.close)
    return { ...server, filePath, dir }
  }

  it('GET /api/document returns lexical, variant, and fileName', async () => {
    const { port } = await boot(
      '<mxpost><meta><title>t</title></meta><content><p>hi</p></content></mxpost>',
    )
    const res = await rawRequest({
      port,
      url: '/api/document',
      headers: { host: `127.0.0.1:${port}` },
    })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      lexical: { xml: '<p>hi</p>' },
      variant: 'article',
      fileName: 'article.xml',
      revision: 0,
    })
  })

  it('PUT /api/document writes xml and a sidecar diff', async () => {
    const { port, filePath } = await boot(
      '<mxpost><meta><title>t</title></meta><content><p>old</p></content></mxpost>',
    )
    const res = await rawRequest({
      port,
      method: 'PUT',
      url: '/api/document',
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lexical: { xml: '<p>new</p>' } }),
    })
    expect(res.status).toBe(200)
    const json = JSON.parse(res.body) as { ok: boolean; diffPath: string }
    expect(json.ok).toBe(true)
    expect(json.diffPath).toBe(`${filePath}.diff`)
    const xml = await readFile(filePath, 'utf8')
    expect(xml).toContain('<title>t</title>')
    expect(xml).toContain('<p>new</p>')
    expect(xml).not.toContain('<p>old</p>')
    const diff = await readFile(`${filePath}.diff`, 'utf8')
    expect(diff).toContain('-<p>old</p>')
    expect(diff).toContain('+<p>new</p>')
  })

  it('PUT /api/baseline replaces the diff baseline until the first save', async () => {
    const { port, filePath } = await boot(
      '<mxpost><meta><title>t</title></meta><content><p>old</p></content></mxpost>',
    )
    const put = (url: string, xml: string) =>
      rawRequest({
        port,
        method: 'PUT',
        url,
        headers: {
          host: `127.0.0.1:${port}`,
          origin: `http://127.0.0.1:${port}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ lexical: { xml } }),
      })
    expect(JSON.parse((await put('/api/baseline', '<p id="a">old</p>')).body))
      .toEqual({ ok: true, applied: true })
    await put('/api/document', '<p id="a">new</p>')
    const diff = await readFile(`${filePath}.diff`, 'utf8')
    expect(diff).toContain('-<p id="a">old</p>')
    expect(diff).not.toContain('-<p>old</p>')
    expect(JSON.parse((await put('/api/baseline', '<p>ignored</p>')).body))
      .toEqual({ ok: true, applied: false })
  })

  it('rejects a non-local Host', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const res = await rawRequest({
      port,
      url: '/api/document',
      headers: { host: 'evil.example' },
    })
    expect(res.status).toBe(403)
  })

  it('rejects a cross-origin Origin', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const res = await rawRequest({
      port,
      method: 'PUT',
      url: '/api/document',
      headers: {
        host: `127.0.0.1:${port}`,
        origin: 'http://evil.example',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lexical: { xml: '<p>nope</p>' } }),
    })
    expect(res.status).toBe(403)
  })

  it('returns { error } and leaves the file unchanged when serialize fails', async () => {
    const source = '<p>keep</p>'
    const { port, filePath } = await boot(source, 'frag.xml')
    const res = await rawRequest({
      port,
      method: 'PUT',
      url: '/api/document',
      headers: {
        host: `localhost:${port}`,
        origin: `http://localhost:${port}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lexical: { nope: true } }),
    })
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body)).toEqual({
      error: { message: 'bad lexical' },
    })
    expect(await readFile(filePath, 'utf8')).toBe(source)
  })

  it('serves the SPA index', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const res = await rawRequest({
      port,
      url: '/',
      headers: { host: `127.0.0.1:${port}` },
    })
    expect(res.status).toBe(200)
    expect(res.body).toContain('author')
  })

  it('streams an external revision over SSE and logs the ack', async () => {
    const { port, pushRevision } = await boot(
      '<mxpost><meta><title>t</title></meta><content><p>hi</p></content></mxpost>',
    )
    const events: string[] = []
    const stream = await new Promise<import('node:http').IncomingMessage>(
      (resolve) => {
        http
          .get(
            { host: '127.0.0.1', port, path: '/api/events' },
            resolve,
          )
          .end()
      },
    )
    stream.on('data', (chunk: Buffer) => events.push(chunk.toString()))
    await new Promise((r) => setTimeout(r, 20))

    pushRevision(
      '<mxpost><meta><title>t</title></meta><content><p>agent</p></content></mxpost>',
    )
    await new Promise((r) => setTimeout(r, 20))
    const payload = events.join('')
    expect(payload).toContain('event: revision')
    expect(payload).toContain('"revision":1')
    expect(payload).toContain('<p>agent</p>')

    const ack = await rawRequest({
      port,
      method: 'POST',
      url: '/api/ack',
      headers: { host: `127.0.0.1:${port}` },
      body: JSON.stringify({ revision: 1, conflicts: 2 }),
    })
    expect(ack.status).toBe(200)
    expect(logs).toContain('revision 1 applied, 2 conflicts')
    stream.destroy()
  })

  it('ignores a revision equal to its own last save', async () => {
    const source =
      '<mxpost><meta><title>t</title></meta><content><p>hi</p></content></mxpost>'
    const { pushRevision } = await boot(source)
    pushRevision(source)
    expect(logs).toEqual([])
  })
})
