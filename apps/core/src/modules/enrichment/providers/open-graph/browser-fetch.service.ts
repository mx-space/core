import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { Injectable, Logger } from '@nestjs/common'

import {
  AgentBrowserSessionPool,
  type PoolSlot,
} from '~/processors/agent-browser/agent-browser-pool.service'
import {
  assertHostnameSafe,
  parseAndValidateUrl,
  UnsafeUrlError,
} from '~/processors/agent-browser/url-guard'

import {
  ChallengeBlockedError,
  type EnrichmentResult,
} from '../../enrichment.types'
import {
  OG_ACCEPT_LANGUAGE,
  OG_CHALLENGE_RETRY_MAX,
  OG_CHALLENGE_SIGNATURES,
  OG_HTML_SCAN_HEAD_BYTES,
  OG_LAUNCH_ARGS,
  OG_NETWORKIDLE_MS,
  OG_USER_AGENT,
} from './og-browser-constants'
import type { SafeFetchOptions, SafeFetchResult } from './safe-fetch'

const execFileAsync = promisify(execFile)

const DEFAULT_EXECUTABLE = process.env.AGENT_BROWSER_BIN || 'agent-browser'

const SCREENSHOT_CLI_QUALITY = 90
const SCREENSHOT_CLI_FORMAT = 'jpeg' as const
const SCREENSHOT_CLI_EXT = '.jpeg'

const SCREENSHOT_VIEWPORT_WIDTH = 1280
const SCREENSHOT_VIEWPORT_HEIGHT = 720

interface FetchPageResult {
  html: SafeFetchResult
  screenshotBytes?: Buffer
}

interface NavigationPayload {
  href: string
  html: string
  title: string
}

type CaptureScreenshotDecision =
  | boolean
  | ((html: SafeFetchResult) => boolean | Promise<boolean>)

type BrowserFetchOptions = SafeFetchOptions & {
  executable?: string
  captureScreenshot?: CaptureScreenshotDecision
}

const PAGE_SCRIPT = [
  '(() => { try { return JSON.stringify({ href: window.location.href, ',
  'html: document.documentElement.outerHTML, ',
  'title: document.title || "" }) } catch (_e) { ',
  'return JSON.stringify({ href: window.location.href, html: "", title: "" }) } })()',
].join('')
const PAGE_B64 = Buffer.from(PAGE_SCRIPT, 'utf8').toString('base64')

@Injectable()
export class BrowserFetchService {
  private readonly logger = new Logger(BrowserFetchService.name)

  private readonly bytesByResult = new WeakMap<EnrichmentResult, Buffer>()

  constructor(private readonly pool: AgentBrowserSessionPool) {}

  async fetchHtml(
    rawUrl: string,
    opts: SafeFetchOptions & { executable?: string },
  ): Promise<SafeFetchResult> {
    const { html } = await this.runSession(rawUrl, opts, false)
    return html
  }

  async fetchPage(
    rawUrl: string,
    opts: BrowserFetchOptions,
  ): Promise<FetchPageResult> {
    return this.runSession(rawUrl, opts, opts.captureScreenshot ?? true)
  }

  attachScreenshotBytes(result: EnrichmentResult, bytes: Buffer): void {
    this.bytesByResult.set(result, bytes)
  }

  takeScreenshotBytes(result: EnrichmentResult): Buffer | undefined {
    const buf = this.bytesByResult.get(result)
    this.bytesByResult.delete(result)
    return buf
  }

  private async runSession(
    rawUrl: string,
    opts: SafeFetchOptions & { executable?: string },
    captureScreenshot: CaptureScreenshotDecision,
  ): Promise<FetchPageResult> {
    const url = parseAndValidateUrl(rawUrl)
    await assertHostnameSafe(url.hostname)

    const slot: PoolSlot = await this.pool.acquire()
    const executable = opts.executable || DEFAULT_EXECUTABLE

    const started = Date.now()
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)

    let html: SafeFetchResult
    try {
      let payload = await this.runNavigationBatch(
        executable,
        slot,
        url,
        ac,
        opts,
      )
      this.pool.markLive(slot)
      let safeUrl = await this.assertBrowserFinalUrlSafe(payload.href)

      const statusFailure = await this.fetchDocumentStatus(
        executable,
        slot,
        url,
        ac,
      )
      if (statusFailure) {
        throw new Error(
          `agent-browser navigation returned HTTP ${statusFailure.status} for ${statusFailure.url}`,
        )
      }

      let signature = this.detectChallenge(payload.html, payload.title)
      let retries = 0
      while (signature && retries < OG_CHALLENGE_RETRY_MAX) {
        retries += 1
        payload = await this.reloadAndExtract(executable, slot, ac, opts)
        safeUrl = await this.assertBrowserFinalUrlSafe(payload.href)
        signature = this.detectChallenge(payload.html, payload.title)
      }
      if (signature) {
        throw new ChallengeBlockedError(url.toString(), signature)
      }

      const truncated = payload.html.length > opts.maxBodyBytes
      const body = truncated
        ? payload.html.slice(0, opts.maxBodyBytes)
        : payload.html
      html = {
        finalUrl: safeUrl.toString(),
        contentType: 'text/html',
        body,
        truncated,
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string }
      if (ac.signal.aborted) {
        this.pool.release(slot)
        throw new Error(
          `agent-browser timed out after ${opts.timeoutMs}ms for ${url.toString()}`,
          { cause: error },
        )
      }
      if (
        error instanceof UnsafeUrlError ||
        error instanceof ChallengeBlockedError
      ) {
        this.pool.release(slot)
        throw error
      }
      // Surface HTTP-status throw from fetchDocumentStatus without discarding
      // the slot — chromium is still healthy.
      if (
        err instanceof Error &&
        err.message.startsWith('agent-browser navigation returned HTTP')
      ) {
        this.pool.release(slot)
        throw err
      }
      // Non-timeout CLI failure: discard the slot so a wedged chromium does
      // not poison the next caller.
      this.pool.release(slot, { discard: true })
      if (err.code === 'ENOENT') {
        throw new Error(
          `agent-browser executable not found at "${executable}". Install it or set thirdPartyServiceIntegration.openGraph.fetchMode = "fetch".`,
          { cause: error },
        )
      }
      const detail = err.stderr ? `: ${truncate(err.stderr, 400)}` : ''
      throw new Error(`agent-browser failed for ${url.toString()}${detail}`, {
        cause: error,
      })
    } finally {
      clearTimeout(timer)
    }

    let screenshotBytes: Buffer | undefined
    let shouldCapture: boolean
    if (typeof captureScreenshot === 'function') {
      try {
        shouldCapture = await captureScreenshot(html)
      } catch (predicateErr) {
        this.logger.debug(
          `screenshot decision predicate failed for ${url.toString()}: ${(predicateErr as Error).message}`,
        )
        shouldCapture = false
      }
    } else {
      shouldCapture = captureScreenshot
    }
    if (shouldCapture) {
      const remaining = Math.max(500, opts.timeoutMs - (Date.now() - started))
      screenshotBytes = await this.captureScreenshot(
        executable,
        slot,
        remaining,
      ).catch((screenshotErr) => {
        this.logger.debug(
          `screenshot capture failed for ${url.toString()}: ${(screenshotErr as Error).message}`,
        )
        return undefined
      })
    }

    this.pool.release(slot)
    return { html, screenshotBytes }
  }

  private buildBaseArgs(slot: PoolSlot): string[] {
    return [
      '--session',
      slot.name,
      '--user-agent',
      OG_USER_AGENT,
      '--headers',
      JSON.stringify({ 'Accept-Language': OG_ACCEPT_LANGUAGE }),
      '--args',
      OG_LAUNCH_ARGS,
    ]
  }

  private async runNavigationBatch(
    executable: string,
    slot: PoolSlot,
    url: URL,
    ac: AbortController,
    opts: SafeFetchOptions,
  ): Promise<NavigationPayload> {
    const { stdout } = await execFileAsync(
      executable,
      [
        ...this.buildBaseArgs(slot),
        'batch',
        '--bail',
        '--json',
        `open ${url.toString()}`,
        `wait --load networkidle --timeout ${OG_NETWORKIDLE_MS}`,
        `eval -b ${PAGE_B64}`,
      ],
      {
        signal: ac.signal,
        maxBuffer: Math.max(opts.maxBodyBytes * 2, 4_194_304),
        windowsHide: true,
        env: process.env,
      },
    )
    return parseNavigationPayload(extractStringFromBatchOutput(stdout))
  }

  private async reloadAndExtract(
    executable: string,
    slot: PoolSlot,
    ac: AbortController,
    opts: SafeFetchOptions,
  ): Promise<NavigationPayload> {
    const { stdout } = await execFileAsync(
      executable,
      [
        ...this.buildBaseArgs(slot),
        'batch',
        '--bail',
        '--json',
        'reload',
        `wait --load networkidle --timeout ${OG_NETWORKIDLE_MS}`,
        `eval -b ${PAGE_B64}`,
      ],
      {
        signal: ac.signal,
        maxBuffer: Math.max(opts.maxBodyBytes * 2, 4_194_304),
        windowsHide: true,
        env: process.env,
      },
    )
    return parseNavigationPayload(extractStringFromBatchOutput(stdout))
  }

  private async fetchDocumentStatus(
    executable: string,
    slot: PoolSlot,
    url: URL,
    ac: AbortController,
  ): Promise<{ status: number; url: string } | null> {
    const hostGlob = `${url.protocol}//${url.hostname}/**`
    let stdout: string
    try {
      const res = await execFileAsync(
        executable,
        [
          ...this.buildBaseArgs(slot),
          'network',
          'requests',
          '--filter',
          hostGlob,
          '--type',
          'document',
          '--status',
          '400-599',
          '--json',
        ],
        {
          signal: ac.signal,
          maxBuffer: 1_048_576,
          windowsHide: true,
          env: process.env,
        },
      )
      stdout = res.stdout
    } catch (error) {
      // `network requests` is a diagnostic side channel — if the CLI does not
      // implement the filter shape we expect, swallow and let the main flow
      // proceed. The challenge detector covers the most common bad-page case.
      this.logger.debug(
        `network requests inspection failed for ${url.toString()}: ${(error as Error).message}`,
      )
      return null
    }
    const trimmed = stdout.trim()
    if (!trimmed) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return null
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    // Last entry is the final navigation after any redirect chain.
    const last = parsed.at(-1) as
      | { status?: unknown; url?: unknown }
      | undefined
    const status = typeof last?.status === 'number' ? last.status : NaN
    const reqUrl = typeof last?.url === 'string' ? last.url : url.toString()
    if (!Number.isFinite(status) || status < 400) return null
    return { status, url: reqUrl }
  }

  private detectChallenge(html: string, title: string): string | null {
    const headHtml = html.slice(0, OG_HTML_SCAN_HEAD_BYTES).toLowerCase()
    const lowerTitle = title.toLowerCase()
    for (const signature of OG_CHALLENGE_SIGNATURES) {
      if (lowerTitle.includes(signature) || headHtml.includes(signature)) {
        return signature
      }
    }
    return null
  }

  private async assertBrowserFinalUrlSafe(rawUrl: string): Promise<URL> {
    const url = parseAndValidateUrl(rawUrl)
    await assertHostnameSafe(url.hostname)
    return url
  }

  private async captureScreenshot(
    executable: string,
    slot: PoolSlot,
    timeoutMs: number,
  ): Promise<Buffer | undefined> {
    const dir = await mkdtemp(join(tmpdir(), 'mx-og-screenshot-'))
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), timeoutMs)
      try {
        await execFileAsync(
          executable,
          [
            ...this.buildBaseArgs(slot),
            'set',
            'viewport',
            String(SCREENSHOT_VIEWPORT_WIDTH),
            String(SCREENSHOT_VIEWPORT_HEIGHT),
          ],
          {
            signal: ac.signal,
            maxBuffer: 1_048_576,
            windowsHide: true,
            env: process.env,
          },
        )
        await execFileAsync(
          executable,
          [
            ...this.buildBaseArgs(slot),
            'screenshot',
            '--screenshot-format',
            SCREENSHOT_CLI_FORMAT,
            '--screenshot-quality',
            String(SCREENSHOT_CLI_QUALITY),
            '--screenshot-dir',
            dir,
          ],
          {
            signal: ac.signal,
            maxBuffer: 8_388_608,
            windowsHide: true,
            env: process.env,
          },
        )
      } finally {
        clearTimeout(timer)
      }

      const entries = await readdir(dir)
      const matches = entries.filter(
        (name) =>
          name.toLowerCase().endsWith(SCREENSHOT_CLI_EXT) ||
          name.toLowerCase().endsWith('.jpg'),
      )
      if (matches.length !== 1) {
        this.logger.debug(
          `screenshot capture produced ${matches.length} matching files in ${dir}; expected 1`,
        )
        return undefined
      }
      return await readFile(join(dir, matches[0]))
    } finally {
      try {
        await rm(dir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }
}

function parseNavigationPayload(raw: string): NavigationPayload {
  try {
    const parsed = JSON.parse(raw) as {
      href?: unknown
      html?: unknown
      title?: unknown
    }
    return {
      href: typeof parsed.href === 'string' ? parsed.href : '',
      html: typeof parsed.html === 'string' ? parsed.html : '',
      title: typeof parsed.title === 'string' ? parsed.title : '',
    }
  } catch {
    return { href: '', html: raw, title: '' }
  }
}

function extractStringFromBatchOutput(stdout: string): string {
  const trimmed = stdout.trim()
  if (!trimmed) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return ''
  }
  if (!Array.isArray(parsed)) return ''
  const last = parsed.at(-1) as { result?: { result?: unknown } } | undefined
  const value = last?.result?.result
  return typeof value === 'string' ? value : ''
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
