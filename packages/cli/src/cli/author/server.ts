import { createReadStream, existsSync, statSync } from 'node:fs'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { extname, join, normalize, relative, sep } from 'node:path'

import type { OpId } from 'loro-crdt'

import type { AuthorDocument } from './document'
import type { AuthorSession } from './session'

export interface AuthorCodec {
  readonly litexmlToLexical: (xml: string) => unknown
  readonly lexicalToLitexml: (lexical: unknown) => string
}

export interface AuthorServerOptions {
  readonly doc: AuthorDocument
  readonly session: AuthorSession
  readonly spaDir: string
  readonly port: number
  readonly log?: (line: string) => void
}

export interface AuthorServer {
  readonly port: number
  readonly close: () => Promise<void>
}

interface LiveState {
  client: ServerResponse | null
}

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
}

export async function startAuthorServer(
  options: AuthorServerOptions,
): Promise<AuthorServer> {
  const { log = () => undefined } = options
  const live: LiveState = { client: null }
  const unsubscribe = options.session.subscribe((event) => {
    if (!live.client) return
    if (event.type === 'update') {
      sendEvent(live.client, 'update', {
        bytes: Buffer.from(event.bytes).toString('base64'),
      })
    } else if (event.type === 'cursor') {
      sendEvent(live.client, 'cursor', { cursor: event.cursor })
    } else {
      sendEvent(live.client, 'status', { invalid: event.invalid })
    }
  })
  const server = createServer((req, res) => {
    void handle(req, res, { ...options, log, port: listeningPort }, live)
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
        unsubscribe()
        live.client?.end()
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}

const sendEvent = (res: ServerResponse, event: string, data: unknown) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

const parseOpId = (value: unknown): OpId => {
  const { peer, counter } = (value ?? {}) as Record<string, unknown>
  const count = Number(counter)
  if (
    typeof peer !== 'string' ||
    !/^\d+$/.test(peer) ||
    !Number.isInteger(count)
  ) {
    throw new Error('expected { peer, counter }')
  }
  return { peer: peer as OpId['peer'], counter: count }
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
  const route = `${req.method} ${url.pathname}`
  try {
    switch (route) {
      case 'GET /api/document': {
        json(res, 200, {
          snapshot: Buffer.from(ctx.session.snapshot()).toString('base64'),
          variant: ctx.doc.variant,
          fileName: ctx.doc.filePath.split(/[/\\]/).pop(),
          invalid: ctx.session.invalid(),
          lineage: ctx.session.lineage(),
        })
        return
      }
      case 'POST /api/update': {
        ctx.session.importUpdate(new Uint8Array(await readBuffer(req)))
        json(res, 200, { ok: true })
        return
      }
      case 'POST /api/flush': {
        await ctx.session.flush()
        ctx.log(`saved ${ctx.doc.filePath}`)
        json(res, 200, { ok: true, diffPath: `${ctx.doc.filePath}.diff` })
        return
      }
      case 'GET /api/history': {
        json(res, 200, { entries: ctx.session.history() })
        return
      }
      case 'GET /api/history/preview': {
        const id = parseOpId({
          peer: url.searchParams.get('peer'),
          counter: url.searchParams.get('counter'),
        })
        json(res, 200, { lexical: ctx.session.preview(id) })
        return
      }
      case 'POST /api/history/restore': {
        const id = parseOpId(
          JSON.parse((await readBuffer(req)).toString('utf8')),
        )
        ctx.session.restore(id)
        ctx.log(`restored ${id.counter}@${id.peer}`)
        json(res, 200, { ok: true })
        return
      }
      case 'GET /api/events': {
        live.client?.end()
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
    }
  } catch (err) {
    json(res, 400, { error: { message: messageOf(err) } })
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

const readBuffer = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
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
