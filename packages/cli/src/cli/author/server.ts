import { createReadStream, existsSync, statSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { extname, join, normalize, relative, sep } from 'node:path'

import type { LexicalState } from '../../services/Lexical'
import { annotateDiffNotes, resolveDiffNotes } from './diff-note'
import {
  applyAuthorBody,
  type AuthorDocument,
  type AuthorFs,
  currentAuthorBody,
  persistAuthorSave,
  setAuthorBaseline,
} from './document'

export interface AuthorCodec {
  readonly litexmlToLexical: (xml: string) => unknown
  readonly lexicalToLitexml: (lexical: unknown) => string
}

export interface AuthorServerOptions {
  readonly doc: AuthorDocument
  readonly spaDir: string
  readonly codec: AuthorCodec
  readonly fs: AuthorFs
  readonly port: number
  readonly base?: LexicalState
  readonly log?: (line: string) => void
}

export interface AuthorServer {
  readonly port: number
  readonly close: () => Promise<void>
  readonly pushRevision: (fileText: string) => void
}

interface LiveState {
  revision: number
  lastRemoteText: string | null
  client: ServerResponse | null
}

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

export async function startAuthorServer(
  options: AuthorServerOptions,
): Promise<AuthorServer> {
  const { doc, spaDir, codec, fs, base, log = () => undefined } = options
  const live: LiveState = { revision: 0, lastRemoteText: null, client: null }
  const server = createServer((req, res) => {
    void handle(
      req,
      res,
      { doc, spaDir, codec, fs, base, log, port: listeningPort },
      live,
    )
  })

  let listeningPort = options.port
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') listeningPort = addr.port
      resolve()
    })
  })

  return {
    port: listeningPort,
    close: () =>
      new Promise((resolve, reject) => {
        live.client?.end()
        server.close((err) => (err ? reject(err) : resolve()))
      }),
    pushRevision: (fileText) => {
      if (fileText === doc.lastFileText || fileText === live.lastRemoteText) {
        return
      }
      live.lastRemoteText = fileText
      let lexical: unknown
      try {
        lexical = codec.litexmlToLexical(
          currentAuthorBody({ ...doc, lastFileText: fileText }),
        )
      } catch (err) {
        log(`revision rejected: ${messageOf(err)}`)
        return
      }
      doc.lastFileText = fileText
      live.revision += 1
      if (!live.client) {
        log(`revision ${live.revision} pending (no editor connected)`)
        return
      }
      sendEvent(live.client, 'revision', { revision: live.revision, lexical })
    },
  }
}

const sendEvent = (res: ServerResponse, event: string, data: unknown) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

const handle = async (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Required<Pick<AuthorServerOptions, 'log'>> & AuthorServerOptions,
  live: LiveState,
): Promise<void> => {
  const host = req.headers.host ?? ''
  if (!isLocalHost(host, ctx.port)) {
    json(res, 403, { error: { message: 'forbidden host' } })
    return
  }
  const origin = req.headers.origin
  if (typeof origin === 'string' && !isLocalOrigin(origin, ctx.port)) {
    json(res, 403, { error: { message: 'forbidden origin' } })
    return
  }

  const url = new URL(req.url ?? '/', `http://127.0.0.1:${ctx.port}`)
  if (url.pathname === '/api/document' && req.method === 'GET') {
    try {
      const current = ctx.codec.litexmlToLexical(currentAuthorBody(ctx.doc))
      const lexical =
        ctx.base && !ctx.doc.saved
          ? annotateDiffNotes(ctx.base, current as LexicalState)
          : current
      json(res, 200, {
        lexical,
        variant: ctx.doc.variant,
        fileName: ctx.doc.filePath.split(/[/\\]/).pop(),
        revision: live.revision,
      })
    } catch (err) {
      json(res, 400, { error: { message: messageOf(err) } })
    }
    return
  }

  if (url.pathname === '/api/baseline' && req.method === 'PUT') {
    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw) as { lexical?: unknown }
      const body = ctx.codec.lexicalToLitexml(
        resolveDiffNotes(parsed.lexical, 'original'),
      )
      json(res, 200, { ok: true, applied: setAuthorBaseline(ctx.doc, body) })
    } catch (err) {
      json(res, 400, { error: { message: messageOf(err) } })
    }
    return
  }

  if (url.pathname === '/api/document' && req.method === 'PUT') {
    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw) as { lexical?: unknown }
      const body = ctx.codec.lexicalToLitexml(
        resolveDiffNotes(parsed.lexical, 'proposed'),
      )
      const applied = applyAuthorBody(ctx.doc, body)
      await persistAuthorSave(ctx.doc, applied.fileText, applied.diff, ctx.fs)
      ctx.log(`saved ${ctx.doc.filePath}`)
      json(res, 200, { ok: true, diffPath: applied.diffPath })
    } catch (err) {
      json(res, 400, { error: { message: messageOf(err) } })
    }
    return
  }

  if (url.pathname === '/api/events' && req.method === 'GET') {
    if (live.client) {
      json(res, 409, { error: { message: 'another editor is connected' } })
      return
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    live.client = res
    req.on('close', () => {
      if (live.client === res) live.client = null
    })
    return
  }

  if (url.pathname === '/api/ack' && req.method === 'POST') {
    try {
      const raw = await readBody(req)
      const parsed = JSON.parse(raw) as {
        revision?: number
        conflicts?: number
      }
      ctx.log(
        `revision ${parsed.revision ?? '?'} applied, ${parsed.conflicts ?? 0} conflicts`,
      )
      json(res, 200, { ok: true })
    } catch (err) {
      json(res, 400, { error: { message: messageOf(err) } })
    }
    return
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveSpa(res, ctx.spaDir, url.pathname, req.method === 'HEAD')
    return
  }

  json(res, 405, { error: { message: 'method not allowed' } })
}

const isLocalHost = (host: string, port: number): boolean => {
  const value = host.trim().toLowerCase()
  return (
    value === '127.0.0.1' ||
    value === 'localhost' ||
    value === `127.0.0.1:${port}` ||
    value === `localhost:${port}`
  )
}

const isLocalOrigin = (origin: string, port: number): boolean => {
  const value = origin.trim().toLowerCase()
  return (
    value === `http://127.0.0.1:${port}` || value === `http://localhost:${port}`
  )
}

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message
  return String(err)
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const serveSpa = (
  res: ServerResponse,
  spaDir: string,
  pathname: string,
  head: boolean,
): void => {
  const decoded = decodeURIComponent(pathname)
  const relativePath =
    decoded === '/' ? 'index.html' : decoded.replace(/^\//, '')
  const resolved = normalize(join(spaDir, relativePath))
  const rel = relative(spaDir, resolved)
  if (rel.startsWith('..') || rel.startsWith(`..${sep}`)) {
    json(res, 403, { error: { message: 'forbidden path' } })
    return
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    json(res, 404, { error: { message: 'not found' } })
    return
  }
  const type = MIME[extname(resolved)] ?? 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  if (head) {
    res.end()
    return
  }
  createReadStream(resolved).pipe(res)
}
