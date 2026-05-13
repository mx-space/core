import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EnrichmentResult } from '~/modules/enrichment/enrichment.types'

// Hoisted so the vi.mock factory below can see the same mock instance the
// test bodies reach via `execFileMock`.
const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}))

vi.mock('node:child_process', async () => {
  const actual =
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process',
    )
  return {
    ...actual,
    execFile: execFileMock,
  }
})

// SSRF guard's `assertHostnameSafe` runs a real DNS lookup against the URL
// hostname. The CI / dev machine may resolve `example.com` through a captive
// portal or CGNAT-style 198.18.x address, which `isPrivateIp` correctly
// rejects. We mock the DNS module to a stable public IP so the guard accepts
// the hostnames used by these tests, and so we don't hit network in unit
// tests. The `file://` protocol test goes through the protocol check, which
// runs before DNS, so the mock does not need to special-case it.
vi.mock('node:dns/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:dns/promises')>(
      'node:dns/promises',
    )
  return {
    ...actual,
    lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  }
})

// Import service AFTER the vi.mock setup so `promisify(execFile)` resolves to
// the mocked execFile. The mocked fn lacks `util.promisify.custom`, so
// `promisify` wraps it via the standard last-callback contract.
const { BrowserFetchService } =
  await import('~/modules/enrichment/providers/open-graph/browser-fetch.service')
const { BrowserSessionPool } =
  await import('~/modules/enrichment/providers/open-graph/browser-session-pool')

interface ExecFileCall {
  args: string[]
  options: Record<string, unknown>
}

function setExecFileBehavior(
  cb: (call: ExecFileCall) =>
    | {
        stdout?: string
        stderr?: string
        error?: NodeJS.ErrnoException
      }
    | Promise<{
        stdout?: string
        stderr?: string
        error?: NodeJS.ErrnoException
      }>,
): void {
  execFileMock.mockImplementation((...invocationArgs: unknown[]) => {
    const args = invocationArgs[1] as string[]
    const options = (invocationArgs[2] as Record<string, unknown>) ?? {}
    const callback = invocationArgs.at(-1) as (
      err: NodeJS.ErrnoException | null,
      result?: { stdout: string; stderr: string },
    ) => void
    Promise.resolve(cb({ args, options }))
      .then((res) => {
        if (res.error) {
          callback(res.error)
          return
        }
        callback(null, { stdout: res.stdout ?? '', stderr: res.stderr ?? '' })
      })
      .catch((err) => callback(err as NodeJS.ErrnoException))
    return undefined
  })
}

function parseBatchArgs(args: string[]): {
  sessionName: string
  command: string
  subCommands: string[]
  screenshotDir?: string
} {
  // [--session, <name>, <command>, ...sub commands]
  const sessionName = args[1]
  const command = args[2]
  const subCommands: string[] = []
  let screenshotDir: string | undefined
  for (let i = 3; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) continue
    subCommands.push(a)
    const match = /--screenshot-dir\s+(\S+)/.exec(a)
    if (match) screenshotDir = match[1]
  }
  return { sessionName, command, subCommands, screenshotDir }
}

function buildService() {
  const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
  const service = new BrowserFetchService(pool)
  return { pool, service }
}

describe('BrowserFetchService', () => {
  beforeEach(() => {
    execFileMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('fetchHtml (backward compat)', () => {
    it('returns html-only and never invokes the screenshot step', async () => {
      const calls: ExecFileCall[] = []
      setExecFileBehavior((call) => {
        calls.push(call)
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          // Single batch is the HTML batch (open/wait/eval).
          return {
            stdout: JSON.stringify([
              {},
              {},
              { value: '<html><head><title>x</title></head></html>' },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const html = await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      expect(html.contentType).toBe('text/html')
      expect(html.body).toContain('<title>x</title>')

      const batches = calls.filter(
        (c) => parseBatchArgs(c.args).command === 'batch',
      )
      expect(batches).toHaveLength(1)
      const htmlBatch = parseBatchArgs(batches[0].args)
      expect(htmlBatch.sessionName).toMatch(/^og-pool-\d+$/)
      expect(htmlBatch.subCommands.some((c) => c.startsWith('open '))).toBe(
        true,
      )
      expect(htmlBatch.subCommands.some((c) => c.startsWith('eval '))).toBe(
        true,
      )
      // No screenshot step in fetchHtml.
      expect(
        htmlBatch.subCommands.some((c) => c.startsWith('screenshot')),
      ).toBe(false)

      await pool.shutdown()
    })
  })

  describe('fetchPage', () => {
    it('returns html + screenshotBytes when CLI succeeds and tempfile exists', async () => {
      const fakeWebp = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ])
      const seenScreenshotDirs: string[] = []

      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          const isScreenshotBatch = parsed.subCommands.some((c) =>
            c.startsWith('screenshot'),
          )
          if (isScreenshotBatch) {
            // Simulate the CLI writing a webp to the screenshot-dir.
            const dir = parsed.screenshotDir!
            seenScreenshotDirs.push(dir)
            await writeFile(join(dir, 'capture.webp'), fakeWebp)
            return { stdout: '[]' }
          }
          return {
            stdout: JSON.stringify([
              {},
              {},
              { value: '<html><body>ok</body></html>' },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const res = await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      expect(res.html.body).toContain('<body>ok')
      expect(res.screenshotBytes).toBeInstanceOf(Buffer)
      expect(res.screenshotBytes!.equals(fakeWebp)).toBe(true)

      // Tempdir cleanup: it must have been removed after the call.
      expect(seenScreenshotDirs).toHaveLength(1)
      expect(existsSync(seenScreenshotDirs[0])).toBe(false)

      await pool.shutdown()
    })

    it('returns html with screenshotBytes undefined when screenshot step errors (and cleans tempdir)', async () => {
      const seenScreenshotDirs: string[] = []
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          const isScreenshotBatch = parsed.subCommands.some((c) =>
            c.startsWith('screenshot'),
          )
          if (isScreenshotBatch) {
            if (parsed.screenshotDir)
              seenScreenshotDirs.push(parsed.screenshotDir)
            const err = new Error('boom') as NodeJS.ErrnoException
            return { error: err }
          }
          return {
            stdout: JSON.stringify([
              {},
              {},
              { value: '<html><body>still ok</body></html>' },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const res = await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      expect(res.html.body).toContain('<body>still ok')
      expect(res.screenshotBytes).toBeUndefined()

      expect(seenScreenshotDirs).toHaveLength(1)
      expect(existsSync(seenScreenshotDirs[0])).toBe(false)

      await pool.shutdown()
    })

    it('returns screenshotBytes undefined when no webp file is written', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          const isScreenshotBatch = parsed.subCommands.some((c) =>
            c.startsWith('screenshot'),
          )
          if (isScreenshotBatch) return { stdout: '[]' } // no file written
          return {
            stdout: JSON.stringify([
              {},
              {},
              { value: '<html><body>only html</body></html>' },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const res = await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      expect(res.screenshotBytes).toBeUndefined()
      expect(res.html.body).toContain('only html')

      await pool.shutdown()
    })

    it('appends viewport + screenshot sub-commands in the screenshot batch', async () => {
      const seenSubCommands: string[][] = []
      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          seenSubCommands.push(parsed.subCommands)
          const isScreenshotBatch = parsed.subCommands.some((c) =>
            c.startsWith('screenshot'),
          )
          if (isScreenshotBatch) {
            const dir = parsed.screenshotDir!
            await writeFile(join(dir, 'shot.webp'), Buffer.from([0x00]))
            return { stdout: '[]' }
          }
          return {
            stdout: JSON.stringify([{}, {}, { value: '<html></html>' }]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      const screenshotBatch = seenSubCommands.find((s) =>
        s.some((c) => c.startsWith('screenshot')),
      )
      expect(screenshotBatch).toBeDefined()
      expect(screenshotBatch!.includes('set viewport 1280 720')).toBe(true)
      const screenshotCmd = screenshotBatch!.find((c) =>
        c.startsWith('screenshot'),
      )!
      expect(screenshotCmd).toContain('--screenshot-format webp')
      expect(screenshotCmd).toContain('--screenshot-quality 90')
      expect(screenshotCmd).toContain('--screenshot-dir ')

      await pool.shutdown()
    })
  })

  describe('WeakMap screenshot channel', () => {
    it('attach + take returns the buffer once, undefined on second read', () => {
      const { pool, service } = buildService()
      const result = {
        title: 'x',
        url: 'https://x',
        category: 'web',
      } as EnrichmentResult
      const buf = Buffer.from('payload')
      service.attachScreenshotBytes(result, buf)
      expect(service.takeScreenshotBytes(result)).toBe(buf)
      expect(service.takeScreenshotBytes(result)).toBeUndefined()
      void pool.shutdown()
    })

    it('returns undefined for a result that was never attached', () => {
      const { pool, service } = buildService()
      const result = {
        title: 'x',
        url: 'https://x',
        category: 'web',
      } as EnrichmentResult
      expect(service.takeScreenshotBytes(result)).toBeUndefined()
      void pool.shutdown()
    })
  })

  describe('timeout path', () => {
    it('aborts the HTML batch and throws a timeout error', async () => {
      // Simulate the CLI never returning within the timeout. We invoke the
      // callback only after the AbortController has aborted, with an
      // ECONNABORTED-ish error so the service sees `ac.signal.aborted = true`.
      execFileMock.mockImplementation((...invocationArgs: unknown[]) => {
        const args = invocationArgs[1] as string[]
        const options = invocationArgs[2] as { signal?: AbortSignal }
        const callback = invocationArgs.at(-1) as (
          err: NodeJS.ErrnoException | null,
          result?: { stdout: string; stderr: string },
        ) => void
        // pool.shutdown issues `--session <name> close` against the slot once
        // the timeout path runs through `release` (no discard). That call has
        // no AbortSignal, so we resolve it synchronously instead of leaving
        // the test hanging on a never-resolving promise.
        if (args.includes('close')) {
          queueMicrotask(() => callback(null, { stdout: '', stderr: '' }))
          return undefined
        }
        options.signal?.addEventListener('abort', () => {
          const err = new Error('aborted') as NodeJS.ErrnoException
          err.code = 'ABORT_ERR'
          callback(err)
        })
        return undefined
      })

      const { pool, service } = buildService()
      await expect(
        service.fetchHtml('https://example.com', {
          timeoutMs: 10,
          maxBodyBytes: 4_000_000,
          executable: '/usr/local/bin/agent-browser-fake',
        }),
      ).rejects.toThrow(/timed out after 10ms/)

      await pool.shutdown()
    })
  })

  describe('tempdir cleanup edge case', () => {
    it('removes the screenshot tempdir it created after a successful run', async () => {
      // Race-safe: snapshot exactly the tempdir the service mkdtemp'd via
      // the CLI's --screenshot-dir argument, then assert it is gone after
      // the call. We don't enumerate sibling entries in os.tmpdir(), so
      // parallel test files don't perturb the assertion.
      const seenScreenshotDirs: string[] = []
      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          const isScreenshotBatch = parsed.subCommands.some((c) =>
            c.startsWith('screenshot'),
          )
          if (isScreenshotBatch) {
            const dir = parsed.screenshotDir!
            seenScreenshotDirs.push(dir)
            await writeFile(join(dir, 'c.webp'), Buffer.from([0x01]))
            return { stdout: '[]' }
          }
          return {
            stdout: JSON.stringify([{}, {}, { value: '<html/>' }]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      expect(seenScreenshotDirs).toHaveLength(1)
      expect(existsSync(seenScreenshotDirs[0])).toBe(false)

      await pool.shutdown()
    })
  })

  describe('SSRF guard + pool reuse', () => {
    it('rejects file:// URLs before invoking chromium', async () => {
      // In test/dev mode (__DEV__=true) `parseAndValidateUrl` skips the
      // hostname/IP block-list but still rejects unsupported protocols, so we
      // exercise the protocol guard rather than the localhost block-list.
      const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
      const service = new BrowserFetchService(pool)
      await expect(
        service.fetchPage('file:///etc/passwd', {
          timeoutMs: 5_000,
          maxBodyBytes: 1024,
        }),
      ).rejects.toThrow(/Disallowed protocol/)
      expect(execFileMock).not.toHaveBeenCalled()
      await pool.shutdown()
    })

    it('reuses the same session name across two sequential fetches', async () => {
      const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
      const service = new BrowserFetchService(pool)
      setExecFileBehavior(() => ({
        stdout: JSON.stringify([{}, {}, { value: '<html></html>' }]),
      }))
      await service.fetchHtml('https://example.com/a', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
      })
      await service.fetchHtml('https://example.com/b', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
      })
      const openCalls = execFileMock.mock.calls.filter((call) => {
        const args = call[1] as string[]
        return (
          args.includes('batch') &&
          args.some((a: string) => a.startsWith('open '))
        )
      })
      expect(openCalls.length).toBe(2)
      const sessionNames = new Set(
        openCalls.map((call) => (call[1] as string[])[1]),
      )
      expect(sessionNames.size).toBe(1)
      await pool.shutdown()
    })
  })
})
