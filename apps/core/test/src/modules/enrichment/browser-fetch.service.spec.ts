import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ChallengeBlockedError,
  type EnrichmentResult,
} from '~/modules/enrichment/enrichment.types'

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

const { BrowserFetchService } =
  await import('~/modules/enrichment/providers/open-graph/browser-fetch.service')
const { BrowserSessionPool } =
  await import('~/modules/enrichment/providers/open-graph/browser-session-pool')
const { OG_ACCEPT_LANGUAGE, OG_LAUNCH_ARGS, OG_NETWORKIDLE_MS, OG_USER_AGENT } =
  await import('~/modules/enrichment/providers/open-graph/og-browser-constants')

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

interface ParsedCall {
  sessionName: string
  command: string
  subCommands: string[]
  screenshotDir?: string
  flagValue: (flag: string) => string | undefined
}

function parseBatchArgs(args: string[]): ParsedCall {
  const sessionIdx = args.indexOf('--session')
  const sessionName = sessionIdx === -1 ? '' : args[sessionIdx + 1]
  let command = ''
  for (const a of args) {
    if (
      a === 'batch' ||
      a === 'set' ||
      a === 'screenshot' ||
      a === 'network' ||
      a === 'close' ||
      a === 'eval'
    ) {
      command = a
      break
    }
  }
  const cmdIdx = command ? args.indexOf(command) : -1
  const rest = cmdIdx === -1 ? [] : args.slice(cmdIdx + 1)
  const subCommands: string[] = []
  for (const a of rest) {
    if (a.startsWith('--')) continue
    subCommands.push(a)
  }
  const flagValue = (flag: string): string | undefined => {
    const idx = args.indexOf(flag)
    if (idx === -1 || idx + 1 >= args.length) return undefined
    return args[idx + 1]
  }
  const screenshotDir = flagValue('--screenshot-dir')
  return { sessionName, command, subCommands, screenshotDir, flagValue }
}

function navBatchValue(href: string, html: string, title = ''): string {
  return JSON.stringify([
    { command: ['open', href], result: { url: href }, success: true },
    {
      command: ['wait', '--load', 'networkidle'],
      result: {},
      success: true,
    },
    {
      command: ['eval', '-b', '...'],
      result: {
        origin: href,
        result: JSON.stringify({ href, html, title }),
      },
      success: true,
    },
  ])
}

function reloadBatchValue(href: string, html: string, title = ''): string {
  return JSON.stringify([
    { command: ['reload'], result: {}, success: true },
    {
      command: ['wait', '--load', 'networkidle'],
      result: {},
      success: true,
    },
    {
      command: ['eval', '-b', '...'],
      result: {
        origin: href,
        result: JSON.stringify({ href, html, title }),
      },
      success: true,
    },
  ])
}

function isNavigationBatch(parsed: ParsedCall): boolean {
  return (
    parsed.command === 'batch' &&
    parsed.subCommands.some((c) => c.startsWith('open '))
  )
}

function isReloadBatch(parsed: ParsedCall): boolean {
  return parsed.command === 'batch' && parsed.subCommands.includes('reload')
}

function isNetworkRequests(parsed: ParsedCall): boolean {
  return parsed.command === 'network'
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
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><head><title>x</title></head></html>',
              'x',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
      expect(parseBatchArgs(batches[0].args).sessionName).toMatch(
        /^og-pool-\d+$/,
      )
      expect(
        calls.some((c) =>
          parseBatchArgs(c.args).subCommands.some((cmd) =>
            cmd.startsWith('screenshot'),
          ),
        ),
      ).toBe(false)

      await pool.shutdown()
    })

    it('injects UA, Accept-Language, and stealth args on every command', async () => {
      const calls: ExecFileCall[] = []
      setExecFileBehavior((call) => {
        calls.push(call)
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return { stdout: navBatchValue('https://example.com/', '<html/>') }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        if (parsed.command === 'close') return { stdout: '' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
        executable: '/usr/local/bin/agent-browser-fake',
      })

      const navCall = calls.find((c) =>
        isNavigationBatch(parseBatchArgs(c.args)),
      )!
      expect(navCall.args).toContain('--user-agent')
      expect(navCall.args[navCall.args.indexOf('--user-agent') + 1]).toBe(
        OG_USER_AGENT,
      )
      expect(navCall.args).toContain('--headers')
      const headers = JSON.parse(
        navCall.args[navCall.args.indexOf('--headers') + 1],
      )
      expect(headers['Accept-Language']).toBe(OG_ACCEPT_LANGUAGE)
      expect(navCall.args).toContain('--args')
      expect(navCall.args[navCall.args.indexOf('--args') + 1]).toBe(
        OG_LAUNCH_ARGS,
      )
      const navBatchCommands = parseBatchArgs(navCall.args).subCommands
      const waitSub = navBatchCommands.find((c) => c.startsWith('wait '))
      expect(waitSub).toBe(
        `wait --load networkidle --timeout ${OG_NETWORKIDLE_MS}`,
      )

      await pool.shutdown()
    })
  })

  describe('fetchPage', () => {
    it('returns html + screenshotBytes when CLI succeeds and tempfile exists', async () => {
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      const seenScreenshotDirs: string[] = []

      setExecFileBehavior(async (call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>ok</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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

      expect(seenScreenshotDirs).toHaveLength(1)
      expect(existsSync(seenScreenshotDirs[0])).toBe(false)

      await pool.shutdown()
    })

    it('returns html with screenshotBytes undefined when screenshot step errors', async () => {
      const seenScreenshotDirs: string[] = []
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>still ok</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>only html</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
        if (isNavigationBatch(parsed)) {
          return { stdout: navBatchValue('https://example.com/', '<html/>') }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
      const setArgs = setCall!.args
      const setIdx = setArgs.indexOf('set')
      expect(setArgs.slice(setIdx)).toEqual(['set', 'viewport', '1280', '720'])

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
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              finalUrl,
              '<html><body>redirected</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'file:///etc/passwd',
              '<html>should not read</html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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

      expect(seenCommands).not.toContain('screenshot')
      await pool.shutdown()
    })

    it('skips viewport and screenshot commands when captureScreenshot is false', async () => {
      const seenCommands: string[] = []
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        seenCommands.push(parsed.command)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>metadata only</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
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
      expect(seenCommands.filter((c) => c === 'screenshot')).toHaveLength(0)
      expect(seenCommands.filter((c) => c === 'set')).toHaveLength(0)
      await pool.shutdown()
    })
  })

  describe('HTTP status throws', () => {
    it('throws when document request returns 403', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>blocked</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) {
          return {
            stdout: JSON.stringify([
              {
                status: 403,
                url: 'https://example.com/',
                method: 'GET',
                type: 'document',
              },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await expect(
        service.fetchHtml('https://example.com', {
          timeoutMs: 5_000,
          maxBodyBytes: 1024,
          executable: '/usr/local/bin/agent-browser-fake',
        }),
      ).rejects.toThrow(/returned HTTP 403/)
      await pool.shutdown()
    })

    it('throws with the LAST redirect-chain status when multiple rows present', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue('https://example.com/final', '<html/>'),
          }
        }
        if (isNetworkRequests(parsed)) {
          return {
            stdout: JSON.stringify([
              { status: 302, url: 'https://example.com/', type: 'document' },
              {
                status: 500,
                url: 'https://example.com/final',
                type: 'document',
              },
            ]),
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await expect(
        service.fetchHtml('https://example.com', {
          timeoutMs: 5_000,
          maxBodyBytes: 1024,
          executable: '/usr/local/bin/agent-browser-fake',
        }),
      ).rejects.toThrow(/returned HTTP 500 for https:\/\/example\.com\/final/)
      await pool.shutdown()
    })

    it('passes through when network requests output is empty array', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>ok</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const html = await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
        executable: '/usr/local/bin/agent-browser-fake',
      })
      expect(html.body).toContain('ok')
      await pool.shutdown()
    })

    it('passes through when network requests call itself errors', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body>ok</body></html>',
            ),
          }
        }
        if (isNetworkRequests(parsed)) {
          return {
            error: new Error('cli unknown flag') as NodeJS.ErrnoException,
          }
        }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const html = await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
        executable: '/usr/local/bin/agent-browser-fake',
      })
      expect(html.body).toContain('ok')
      await pool.shutdown()
    })
  })

  describe('challenge detection + retry', () => {
    it('retries once via reload and returns clean payload', async () => {
      let navCount = 0
      let reloadCount = 0
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          navCount += 1
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><head><title>Just a moment...</title></head></html>',
              'Just a moment...',
            ),
          }
        }
        if (isReloadBatch(parsed)) {
          reloadCount += 1
          return {
            stdout: reloadBatchValue(
              'https://example.com/',
              '<html><body>real content</body></html>',
              'Real Site',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const html = await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
        executable: '/usr/local/bin/agent-browser-fake',
      })
      expect(navCount).toBe(1)
      expect(reloadCount).toBe(1)
      expect(html.body).toContain('real content')
      await pool.shutdown()
    })

    it('throws ChallengeBlockedError when retry still hits the signature', async () => {
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        const challengeHtml =
          '<html><head><title>Just a moment...</title></head></html>'
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              challengeHtml,
              'Just a moment...',
            ),
          }
        }
        if (isReloadBatch(parsed)) {
          return {
            stdout: reloadBatchValue(
              'https://example.com/',
              challengeHtml,
              'Just a moment...',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      await expect(
        service.fetchHtml('https://example.com', {
          timeoutMs: 5_000,
          maxBodyBytes: 1024,
          executable: '/usr/local/bin/agent-browser-fake',
        }),
      ).rejects.toBeInstanceOf(ChallengeBlockedError)
      await pool.shutdown()
    })

    it('detects challenge from body when title is clean', async () => {
      let reloadFired = false
      setExecFileBehavior((call) => {
        const parsed = parseBatchArgs(call.args)
        if (isNavigationBatch(parsed)) {
          return {
            stdout: navBatchValue(
              'https://example.com/',
              '<html><body><h1>Access Denied</h1></body></html>',
              'normal title',
            ),
          }
        }
        if (isReloadBatch(parsed)) {
          reloadFired = true
          return {
            stdout: reloadBatchValue(
              'https://example.com/',
              '<html><body>ok</body></html>',
              'ok',
            ),
          }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        return { stdout: '' }
      })

      const { pool, service } = buildService()
      const html = await service.fetchHtml('https://example.com', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
        executable: '/usr/local/bin/agent-browser-fake',
      })
      expect(reloadFired).toBe(true)
      expect(html.body).toContain('<body>ok')
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
      execFileMock.mockImplementation((...invocationArgs: unknown[]) => {
        const args = invocationArgs[1] as string[]
        const options = invocationArgs[2] as { signal?: AbortSignal }
        const callback = invocationArgs.at(-1) as (
          err: NodeJS.ErrnoException | null,
          result?: { stdout: string; stderr: string },
        ) => void
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

  describe('SSRF guard + pool reuse', () => {
    it('rejects file:// URLs before invoking chromium', async () => {
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
        if (isNavigationBatch(parsed)) {
          const openSub = parsed.subCommands.find((c) => c.startsWith('open '))!
          const href = openSub.slice('open '.length)
          return { stdout: navBatchValue(href, '<html/>') }
        }
        if (isNetworkRequests(parsed)) return { stdout: '[]' }
        return { stdout: '' }
      })
      await service.fetchHtml('https://example.com/a', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
      })
      await service.fetchHtml('https://example.com/b', {
        timeoutMs: 5_000,
        maxBodyBytes: 1024,
      })
      const navCalls = execFileMock.mock.calls.filter((call) => {
        const args = call[1] as string[]
        return (
          args.includes('batch') &&
          args.some((a: string) => a.startsWith('open '))
        )
      })
      expect(navCalls.length).toBe(2)
      const sessionNames = new Set(
        navCalls.map((call) => {
          const a = call[1] as string[]
          const idx = a.indexOf('--session')
          return a[idx + 1]
        }),
      )
      expect(sessionNames.size).toBe(1)
      await pool.shutdown()
    })
  })
})
