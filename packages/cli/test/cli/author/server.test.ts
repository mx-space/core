import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { allHeadlessNodes } from '@haklex/rich-headless'
import { createLoroBinding } from '@haklex/rich-collab-loro'
import { createHeadlessEditor } from '@lexical/headless'
import { Effect } from 'effect'
import { $getRoot, $isElementNode, $isTextNode } from 'lexical'
import { LoroDoc } from 'loro-crdt'
import { afterEach, describe, expect, it } from 'vitest'

import { openAuthorDocument } from '../../../src/cli/author/document'
import { nodeSessionFs } from '../../../src/cli/author/fs'
import {
  type AuthorCodec,
  startAuthorServer,
} from '../../../src/cli/author/server'
import { createAuthorSession } from '../../../src/cli/author/session'
import { Lexical, type LexicalState } from '../../../src/services/Lexical'

const service = Effect.runSync(Effect.provide(Lexical, Lexical.Default))
const codec: AuthorCodec = {
  litexmlToLexical: (xml) => Effect.runSync(service.litexmlToPayload(xml)),
  lexicalToLitexml: (state) =>
    Effect.runSync(service.payloadToLitexml(state as LexicalState)),
}

const rawRequest = (opts: {
  port: number
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string | Uint8Array
}): Promise<{
  status: number
  body: string
  headers: http.IncomingHttpHeaders
}> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: opts.port,
        method: opts.method ?? 'GET',
        path: opts.url ?? '/',
        headers: { host: `127.0.0.1:${opts.port}`, ...opts.headers },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          }),
        )
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })

const envelope = (body: string) =>
  `<mxpost><meta><title>t</title></meta><content>${body}</content></mxpost>`

describe('startAuthorServer', () => {
  const closers: Array<() => Promise<void>> = []
  const logs: string[] = []

  afterEach(async () => {
    while (closers.length > 0) await closers.pop()?.()
    logs.length = 0
  })

  const boot = async (
    source: string,
    fileName = 'article.xml',
    apiBase?: string,
  ) => {
    const dir = await mkdtemp(join(tmpdir(), 'mxs-author-'))
    const spaDir = join(dir, 'spa')
    await mkdir(spaDir)
    await writeFile(join(spaDir, 'index.html'), '<html>author</html>')
    const filePath = join(dir, fileName)
    await writeFile(filePath, source)
    const doc = openAuthorDocument(filePath, source)
    const log = (line: string) => logs.push(line)
    const session = await createAuthorSession({
      doc,
      codec,
      fs: nodeSessionFs,
      log,
      stepDelayMs: 0,
    })
    const server = await startAuthorServer({
      doc,
      session,
      spaDir,
      port: 0,
      apiBase,
      log,
    })
    closers.push(session.close)
    closers.push(server.close)
    return { ...server, filePath, session }
  }

  const loadClient = async (port: number) => {
    const res = await rawRequest({ port, url: '/api/document' })
    const json = JSON.parse(res.body) as {
      snapshot: string
      variant: string
      fileName: string
      invalid: string | null
    }
    const doc = new LoroDoc()
    doc.import(Buffer.from(json.snapshot, 'base64'))
    const editor = createHeadlessEditor({
      nodes: allHeadlessNodes,
      onError: (err) => {
        throw err
      },
    })
    createLoroBinding(editor, doc)
    return { doc, editor, json }
  }

  it('GET /api/document returns a Loro snapshot, variant, and fileName', async () => {
    const { port } = await boot(envelope('<p>hi</p>'))
    const { editor, json } = await loadClient(port)
    expect(json.variant).toBe('article')
    expect(json.fileName).toBe('article.xml')
    expect(json.invalid).toBeNull()
    expect(
      editor.getEditorState().read(() => $getRoot().getTextContent()),
    ).toBe('hi')
  })

  it('POST /api/update then /api/flush writes xml and the sidecar diff', async () => {
    const { port, filePath } = await boot(envelope('<p>old</p>'))
    const { doc, editor } = await loadClient(port)
    const from = doc.oplogVersion()
    editor.update(
      () => {
        const block = $getRoot().getFirstChild()
        if (!$isElementNode(block)) throw new Error('no block')
        const text = block.getFirstChild()
        if (!$isTextNode(text)) throw new Error('no text')
        text.setTextContent('new')
      },
      { discrete: true },
    )
    const update = await rawRequest({
      port,
      method: 'POST',
      url: '/api/update',
      headers: {
        origin: `http://127.0.0.1:${port}`,
        'content-type': 'application/octet-stream',
      },
      body: doc.export({ mode: 'update', from }),
    })
    expect(update.status).toBe(200)
    const flush = await rawRequest({ port, method: 'POST', url: '/api/flush' })
    expect(JSON.parse(flush.body)).toEqual({
      ok: true,
      diffPath: `${filePath}.diff`,
    })
    const xml = await readFile(filePath, 'utf8')
    expect(xml).toContain('<title>t</title>')
    expect(xml).toContain('<p>new</p>')
    expect(await readFile(`${filePath}.diff`, 'utf8')).toContain('-<p>old</p>')
    expect(logs).toContain(`saved ${filePath}`)
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
      method: 'POST',
      url: '/api/update',
      headers: { origin: 'http://evil.example' },
      body: new Uint8Array([1, 2, 3]),
    })
    expect(res.status).toBe(403)
  })

  it('returns { error } for an update that is not a Loro payload', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const res = await rawRequest({
      port,
      method: 'POST',
      url: '/api/update',
      body: new Uint8Array([1, 2, 3]),
    })
    expect(res.status).toBe(400)
  })

  it('answers a malformed path with 400 and keeps serving', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const bad = await rawRequest({ port, url: '/%E0%A4%A' })
    expect(bad.status).toBe(400)
    const ok = await rawRequest({ port, url: '/' })
    expect(ok.status).toBe(200)
  })

  it('serves the SPA index', async () => {
    const { port } = await boot('<p>x</p>', 'frag.xml')
    const res = await rawRequest({ port, url: '/' })
    expect(res.status).toBe(200)
    expect(res.body).toContain('author')
  })

  it('serves files beside the draft so relative asset paths preview', async () => {
    const { port, filePath } = await boot('<p>x</p>', 'frag.xml')
    const draftDir = join(filePath, '..')
    await mkdir(join(draftDir, 'assets'))
    await writeFile(join(draftDir, 'assets', 'shot.png'), 'png-bytes')
    await writeFile(join(draftDir, '.secret'), 'nope')

    const asset = await rawRequest({ port, url: '/assets/shot.png' })
    expect(asset.status).toBe(200)
    expect(asset.body).toBe('png-bytes')
    expect(asset.headers['content-type']).toBe('image/png')

    const hidden = await rawRequest({ port, url: '/.secret' })
    expect(hidden.status).toBe(404)
    const escape = await rawRequest({ port, url: '/..%2F..%2Fetc%2Fpasswd' })
    expect(escape.status).toBe(403)
    const missing = await rawRequest({ port, url: '/assets/none.png' })
    expect(missing.status).toBe(404)
  })

  it('streams agent edits over SSE as Loro updates', async () => {
    const { port, session, filePath } = await boot(envelope('<p>hi</p>'))
    const events: string[] = []
    const stream = await new Promise<http.IncomingMessage>((resolve) => {
      http.get({ host: '127.0.0.1', port, path: '/api/events' }, resolve).end()
    })
    stream.on('data', (chunk: Buffer) => events.push(chunk.toString()))
    await expect.poll(() => events.join('')).toContain(': connected')
    const agentText = envelope('<p>hi</p><p>agent</p>')
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    await expect
      .poll(() => events.join(''), { timeout: 2000 })
      .toContain('event: update')
    await expect
      .poll(() => events.join(''), { timeout: 2000 })
      .toContain('event: cursor')
    stream.destroy()
  })

  it('lets a reconnecting editor replace a stale event stream', async () => {
    const { port } = await boot(envelope('<p>hi</p>'))
    const open = () =>
      new Promise<http.IncomingMessage>((resolve) => {
        http
          .get({ host: '127.0.0.1', port, path: '/api/events' }, resolve)
          .end()
      })
    const first = await open()
    const second = await open()
    expect(second.statusCode).toBe(200)
    first.destroy()
    second.destroy()
  })

  it('writes the browser selection to <file>.selection.json', async () => {
    const { port, filePath } = await boot(
      envelope('<p id="aaaa">first block</p><p id="bbbb">second block</p>'),
    )
    const selection = {
      collapsed: false,
      text: 'block\n\nsecond',
      blocks: [
        { id: 'aaaa', text: 'block' },
        { id: 'bbbb', text: 'second' },
      ],
    }
    const res = await rawRequest({
      port,
      method: 'POST',
      url: '/api/selection',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(selection),
    })
    expect(res.status).toBe(200)
    const written = JSON.parse(
      await readFile(`${filePath}.selection.json`, 'utf8'),
    ) as typeof selection & { updatedAt: string }
    expect(written).toMatchObject(selection)
    expect(new Date(written.updatedAt).toISOString()).toBe(written.updatedAt)
    const bad = await rawRequest({
      port,
      method: 'POST',
      url: '/api/selection',
      body: JSON.stringify({ collapsed: 'no' }),
    })
    expect(bad.status).toBe(400)
  })

  it('replays the last agent cursor to a newly connected editor', async () => {
    const { port, session, filePath } = await boot(envelope('<p>hi</p>'))
    const agentText = envelope('<p>hi</p><p>agent</p>')
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    const last = session.cursor()
    expect(last).not.toBeNull()
    const events: string[] = []
    const stream = await new Promise<http.IncomingMessage>((resolve) => {
      http.get({ host: '127.0.0.1', port, path: '/api/events' }, resolve).end()
    })
    stream.on('data', (chunk: Buffer) => events.push(chunk.toString()))
    await expect
      .poll(() => events.join(''))
      .toContain(`event: cursor\ndata: ${JSON.stringify({ cursor: last })}`)
    stream.destroy()
  })

  it('lists history, previews, and restores an entry', async () => {
    const { port, session, filePath } = await boot(envelope('<p>one</p>'))
    const agentText = envelope('<p>two</p>')
    await writeFile(filePath, agentText)
    session.onFileText(agentText)
    const history = JSON.parse(
      (await rawRequest({ port, url: '/api/history' })).body,
    ) as {
      entries: Array<{
        id: { peer: string; counter: number }
        message?: string
      }>
    }
    const first = history.entries.at(-1)!
    const preview = JSON.parse(
      (
        await rawRequest({
          port,
          url: `/api/history/preview?peer=${first.id.peer}&counter=${first.id.counter}`,
        })
      ).body,
    ) as { lexical: LexicalState }
    expect(JSON.stringify(preview.lexical)).toContain('one')
    const restore = await rawRequest({
      port,
      method: 'POST',
      url: '/api/history/restore',
      body: JSON.stringify(first.id),
    })
    expect(restore.status).toBe(200)
    await session.flush()
    expect(await readFile(filePath, 'utf8')).toContain('<p>one</p>')
  })

  it('serves the envelope title and follows meta edits', async () => {
    const { port, session } = await boot(envelope('<p>one</p>'))
    const title = async () =>
      JSON.parse((await rawRequest({ port, url: '/api/title' })).body) as {
        title: string | null
      }
    expect(await title()).toEqual({ title: 't' })
    session.onFileText(
      '<mxpost><meta><title>新标题</title></meta><content><p>one</p></content></mxpost>',
    )
    await session.settled()
    expect(await title()).toEqual({ title: '新标题' })
  })

  it('previews the state before an entry so the panel can show its diff', async () => {
    const { port, session } = await boot(envelope('<p>one</p>'))
    session.onFileText(envelope('<p>two</p>'))
    await session.settled()
    const history = JSON.parse(
      (await rawRequest({ port, url: '/api/history' })).body,
    ) as {
      entries: Array<{
        id: { peer: string; counter: number }
        message?: string
        deps: Array<{ peer: string; counter: number }>
      }>
    }
    const agent = history.entries.find((entry) =>
      entry.message?.startsWith('agent'),
    )!
    const query = new URLSearchParams({
      peer: agent.id.peer,
      counter: String(agent.id.counter),
      before: JSON.stringify(agent.deps),
    })
    const preview = JSON.parse(
      (await rawRequest({ port, url: `/api/history/preview?${query}` })).body,
    ) as { lexical: LexicalState; before: LexicalState }
    expect(JSON.stringify(preview.before)).toContain('one')
    expect(JSON.stringify(preview.before)).not.toContain('two')
    expect(JSON.stringify(preview.lexical)).toContain('two')
  })

  it('proxies stock data requests to the configured API base', async () => {
    const upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ path: req.url }))
    })
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
    closers.push(
      () => new Promise<void>((resolve) => upstream.close(() => resolve())),
    )
    const { port: upstreamPort } = upstream.address() as { port: number }
    const { port } = await boot(
      envelope('<p>hi</p>'),
      'article.xml',
      `http://127.0.0.1:${upstreamPort}/api/v3`,
    )

    const res = await rawRequest({
      port,
      url: '/serverless/built-in/stock_bars?symbol=SMH&interval=1d',
    })

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      path: '/api/v3/serverless/built-in/stock_bars?symbol=SMH&interval=1d',
    })
  })
})
