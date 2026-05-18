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
}

const startMockServer = (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<MockServerHandle> =>
  new Promise((resolve) => {
    const server: Server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${addr.port}/api/v2`,
        stop: () => new Promise<void>((r) => server.close(() => r())),
      })
    })
  })

describe('cli --json error envelope', () => {
  let cleanup: () => void
  let server: MockServerHandle

  beforeEach(() => {
    cleanup = makeTmpHome()
  })

  afterEach(async () => {
    await server?.stop()
    cleanup()
  })

  it(
    'emits a wire-format error envelope when the server returns 500',
    async () => {
      server = await startMockServer((req, res) => {
        if (req.url === '/api/v2' || req.url === '/api/v2/') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              data: { name: 'mx-server', version: '2.0.0', authClient: 'better-auth' },
            }),
          )
          return
        }
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'boom' }))
      })

      const res = await runMxs([
        '--api-url',
        server.url,
        '--json',
        'post',
        'list',
      ])

      // Exit code for ServerError is 6 (per exitCodeForTag).
      expect(res.code).toBe(6)

      // Envelope shape: { ok: false, code: "server.error", message: ... }
      const envelope = JSON.parse(res.stdout)
      expect(envelope.ok).toBe(false)
      expect(envelope.code).toBe('server.error')
      expect(typeof envelope.message).toBe('string')
    },
    30_000,
  )
})
