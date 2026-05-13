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
  flagValue: (flag: string) => string | undefined
} {
  // [--session, <name>, <command>, ...rest]
  const sessionName = args[1]
  const command = args[2]
  const rest = args.slice(3)
  const subCommands: string[] = []
  let screenshotDir: string | undefined
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--')) continue
    subCommands.push(a)
    const match = /--screenshot-dir\s+(\S+)/.exec(a)
    if (match) screenshotDir = match[1]
  }
  const flagValue = (flag: string): string | undefined => {
    const idx = rest.indexOf(flag)
    if (idx === -1 || idx + 1 >= rest.length) return undefined
    return rest[idx + 1]
  }
  if (!screenshotDir) screenshotDir = flagValue('--screenshot-dir')
  return { sessionName, command, subCommands, screenshotDir, flagValue }
}

function batchValue(value: string, origin = value): string {
  return JSON.stringify([
    { command: ['open', origin], result: { url: origin }, success: true },
    { command: ['wait', '1500'], result: { ms: 1500 }, success: true },
    {
      command: ['eval', '-b', '...'],
      result: { origin, result: value },
      success: true,
    },
  ])
}

function pageValue(html: string, href = 'https://example.com/'): string {
  return batchValue(JSON.stringify({ href, html }), href)
}

function isNavigationBatch(parsed: ReturnType<typeof parseBatchArgs>): boolean {
  return (
    parsed.command === 'batch' &&
    parsed.subCommands.some((c) => c.startsWith('open '))
  )
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
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : {
                stdout: pageValue('<html><head><title>x</title></head></html>'),
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
      expect(batches).toHaveLength(2)
      expect(parseBatchArgs(batches[0].args).sessionName).toMatch(
        /^og-pool-\d+$/,
      )
      expect(
        batches.some((c) =>
          parseBatchArgs(c.args).subCommands.some((cmd) =>
            cmd.startsWith('open '),
          ),
        ),
      ).toBe(true)
      expect(
        batches.every((c) =>
          parseBatchArgs(c.args).subCommands.some((cmd) =>
            cmd.startsWith('eval '),
          ),
        ),
      )
      // No screenshot step in fetchHtml.
      expect(
        batches.some((c) =>
          parseBatchArgs(c.args).subCommands.some((cmd) =>
            cmd.startsWith('screenshot'),
          ),
        ),
      ).toBe(false)

      await pool.shutdown()
    })
  })

  describe('fetchPage', () => {
    it('returns html + screenshotBytes when CLI succeeds and tempfile exists', async () => {
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      const seenScreenshotDirs: string[] = []

      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html><body>ok</body></html>') }
        }
        if (parsed.command === 'screenshot') {
          const dir = parsed.screenshotDir!
          seenScreenshotDirs.push(dir)
          await writeFile(join(dir, 'capture.jpeg'), fakeJpeg)
          return { stdout: '' }
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
      expect(res.screenshotBytes!.equals(fakeJpeg)).toBe(true)

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
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html><body>still ok</body></html>') }
        }
        if (parsed.command === 'screenshot') {
          if (parsed.screenshotDir)
            seenScreenshotDirs.push(parsed.screenshotDir)
          const err = new Error('boom') as NodeJS.ErrnoException
          return { error: err }
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

    it('returns screenshotBytes undefined when no image file is written', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html><body>only html</body></html>') }
        }
        if (parsed.command === 'screenshot') return { stdout: '' }
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

    it('invokes set-viewport + screenshot as standalone CLI commands with expected flags', async () => {
      const seenCommands: { command: string; args: string[] }[] = []
      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        seenCommands.push({ command: parsed.command, args: call.args })
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html></html>') }
        }
        if (parsed.command === 'screenshot') {
          const dir = parsed.screenshotDir!
          await writeFile(join(dir, 'shot.jpeg'), Buffer.from([0xff, 0xd8]))
          return { stdout: '' }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      const setCall = seenCommands.find((c) => c.command === 'set')
      expect(setCall).toBeDefined()
      expect(setCall!.args.slice(2)).toEqual(['set', 'viewport', '1280', '720'])

      const shotCall = seenCommands.find((c) => c.command === 'screenshot')
      expect(shotCall).toBeDefined()
      const shotArgs = shotCall!.args
      const fmtIdx = shotArgs.indexOf('--screenshot-format')
      expect(fmtIdx).toBeGreaterThan(-1)
      expect(shotArgs[fmtIdx + 1]).toBe('jpeg')
      const qIdx = shotArgs.indexOf('--screenshot-quality')
      expect(qIdx).toBeGreaterThan(-1)
      expect(shotArgs[qIdx + 1]).toBe('90')
      expect(shotArgs).toContain('--screenshot-dir')

      await pool.shutdown()
    })

    it('reports the browser final URL after redirects', async () => {
      const finalUrl = 'https://redirected.example/path?q=1'
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue(finalUrl) }
            : {
                stdout: pageValue(
                  '<html><body>redirected</body></html>',
                  finalUrl,
                ),
              }
        }
        if (parsed.command === 'screenshot') return { stdout: '' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const res = await service.fetchPage('https://example.com/start', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
        captureScreenshot: false,
      })

      expect(res.html.finalUrl).toBe(finalUrl)
      expect(res.html.body).toContain('redirected')
      await pool.shutdown()
    })

    it('rejects unsafe browser final URLs before HTML extraction and screenshot capture', async () => {
      const seenCommands: string[] = []
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        seenCommands.push(parsed.command)
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('file:///etc/passwd') }
            : {
                stdout: pageValue(
                  '<html>should not read</html>',
                  'file:///etc/passwd',
                ),
              }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await expect(
        service.fetchPage('https://example.com/start', {
          timeoutMs: 5_000,
          maxBodyBytes: 4_000_000,
          executable: '/usr/local/bin/agent-browser-fake',
        }),
      ).rejects.toThrow(/Disallowed protocol/)

      expect(
        seenCommands.filter((command) => command === 'batch'),
      ).toHaveLength(1)
      expect(seenCommands).not.toContain('screenshot')
      await pool.shutdown()
    })

    it('skips viewport and screenshot commands when captureScreenshot is false', async () => {
      const seenCommands: string[] = []
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        seenCommands.push(parsed.command)
        if (parsed.command === 'batch') {
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html><body>metadata only</body></html>') }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const res = await service.fetchPage('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 4_000_000,
        executable: '/usr/local/bin/agent-browser-fake',
        captureScreenshot: false,
      })

      expect(res.html.body).toContain('metadata only')
      expect(res.screenshotBytes).toBeUndefined()
      expect(seenCommands).toEqual(['batch', 'batch'])
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
          return isNavigationBatch(parsed)
            ? { stdout: batchValue('https://example.com/') }
            : { stdout: pageValue('<html/>') }
        }
        if (parsed.command === 'screenshot') {
          const dir = parsed.screenshotDir!
          seenScreenshotDirs.push(dir)
          await writeFile(join(dir, 'c.jpeg'), Buffer.from([0xff, 0xd8]))
          return { stdout: '' }
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
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (parsed.command !== 'batch') return { stdout: '' }
        const open = parsed.subCommands.find((c) => c.startsWith('open '))
        const href = open ? open.slice('open '.length) : 'https://example.com/'
        return isNavigationBatch(parsed)
          ? { stdout: batchValue(href) }
          : { stdout: pageValue('<html></html>', href) }
      })
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
