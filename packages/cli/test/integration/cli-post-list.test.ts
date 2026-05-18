import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { makeTmpHome } from './_helpers'

const BIN = fileURLToPath(
  new URL('../../src/bin/mxs.ts', import.meta.url),
)

interface SpawnResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

const runMxs = (
  args: readonly string[],
  env: Record<string, string> = {},
): Promise<SpawnResult> =>
  new Promise((resolve) => {
    const child = spawn('npx', ['tsx', BIN, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('exit', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      }),
    )
  })

interface MockServerHandle {
  readonly url: string
  readonly stop: () => Promise<void>
  readonly requests: Array<{
    readonly method: string
    readonly url: string
    readonly headers: Readonly<Record<string, string | string[] | undefined>>
  }>
}

const startMockServer = (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<MockServerHandle> =>
  new Promise((resolve) => {
    const requests: MockServerHandle['requests'] = [] as any
    const server: Server = createServer((req, res) => {
      requests.push({
        method: req.method ?? 'GET',
        url: req.url ?? '',
        headers: req.headers,
      })
      handler(req, res)
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${addr.port}/api/v2`,
        stop: () => new Promise<void>((r) => server.close(() => r())),
        requests,
      })
    })
  })

describe('cli post list — end-to-end pipeline', () => {
  let cleanup: () => void
  let server: MockServerHandle

  beforeEach(async () => {
    cleanup = makeTmpHome()
  })

  afterEach(async () => {
    await server?.stop()
    cleanup()
  })

  it(
    'fetches /posts via --api-url override and emits JSON',
    async () => {
      server = await startMockServer((req, res) => {
        // Probe (auth detection) → reply with a v2 root document
        if (req.url === '/api/v2/' || req.url === '/api/v2') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              data: { name: 'mx-server', version: '2.0.0', authClient: 'better-auth' },
            }),
          )
          return
        }
        if (req.url?.startsWith('/api/v2/posts')) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              data: [
                {
                  id: 'p1',
                  title: 'Hello',
                  slug: 'hello',
                  is_published: true,
                  created_at: '2026-05-18T00:00:00Z',
                },
              ],
              pagination: { page: 1, size: 10, total: 1 },
            }),
          )
          return
        }
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'not found' }))
      })

      const res = await runMxs([
        '--api-url',
        server.url,
        '--json',
        'post',
        'list',
      ])

      expect(res.code).toBe(0)
      // --json emits a compact envelope ({"ok":true,"data":...}) on stdout.
      expect(res.stdout).toContain('"ok":true')
      expect(res.stdout).toContain('"title":"Hello"')
      // Verify at least one request hit /posts
      const postCalls = server.requests.filter((r) =>
        r.url.startsWith('/api/v2/posts'),
      )
      expect(postCalls.length).toBeGreaterThan(0)
    },
    30_000,
  )
})
