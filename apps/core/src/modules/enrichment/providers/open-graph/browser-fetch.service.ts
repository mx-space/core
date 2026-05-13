import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { Injectable, Logger } from '@nestjs/common'

import type { EnrichmentResult } from '../../enrichment.types'
import { BrowserSessionPool, type PoolSlot } from './browser-session-pool'
import type { SafeFetchOptions, SafeFetchResult } from './safe-fetch'
import { assertHostnameSafe, parseAndValidateUrl } from './url-guard'

const execFileAsync = promisify(execFile)

const DEFAULT_EXECUTABLE = process.env.AGENT_BROWSER_BIN || 'agent-browser'

// Quality knob for the CLI's intermediate webp write. The pipeline re-encodes
// at the configured `webpQuality` (default 75) afterwards, so this only needs
// to be "high enough to survive the round-trip cleanly". 90 leaves enough
// detail that the downstream sharp pass can still aggressively reduce size.
const SCREENSHOT_CLI_QUALITY = 90

const SCREENSHOT_VIEWPORT_WIDTH = 1280
const SCREENSHOT_VIEWPORT_HEIGHT = 720

interface FetchPageResult {
  html: SafeFetchResult
  screenshotBytes?: Buffer
}

/**
 * Headless-browser fetcher backed by the agent-browser CLI. Used as the
 * "browser" fetchMode for the Open Graph provider when sites (Cloudflare,
 * Akamai, JS-rendered SPAs) refuse a plain HTTP request.
 *
 * The CLI is invoked via batch mode in a one-shot named session so:
 *   1. session state is isolated per request (no cookie bleed across URLs);
 *   2. failures clean up the session even if the batch midway crashes;
 *   3. we can plumb a hard timeout via AbortController -> SIGKILL.
 *
 * Body is captured by evaluating `document.documentElement.outerHTML` after
 * page load, then truncated to `maxBodyBytes` so we match safeFetch's
 * post-conditions and feed the existing parseOpenGraph pipeline unchanged.
 *
 * `fetchPage` extends that with an optional viewport screenshot, captured in
 * the SAME named session (no second navigation). The screenshot step is run
 * as a separate `agent-browser` invocation against the same `--session` after
 * the HTML batch returns successfully, so a failure to write/read the webp
 * file cannot mask HTML success or short-circuit the HTML path.
 */
@Injectable()
export class BrowserFetchService {
  private readonly logger = new Logger(BrowserFetchService.name)

  // Request-scoped channel for raw screenshot bytes. `OpenGraphProvider`
  // attaches via `attachScreenshotBytes(result, buf)` keyed off the result
  // instance it is about to return; `EnrichmentService` reads via
  // `takeScreenshotBytes(result)` after persisting the row (it needs the row
  // id before it can write the screenshot row). The WeakMap auto-clears
  // when the result object is garbage-collected, so there is no manual TTL.
  private readonly bytesByResult = new WeakMap<EnrichmentResult, Buffer>()

  constructor(private readonly pool: BrowserSessionPool) {}

  async fetchHtml(
    rawUrl: string,
    opts: SafeFetchOptions & { executable?: string },
  ): Promise<SafeFetchResult> {
    const { html } = await this.runSession(rawUrl, opts, false)
    return html
  }

  async fetchPage(
    rawUrl: string,
    opts: SafeFetchOptions & { executable?: string },
  ): Promise<FetchPageResult> {
    return this.runSession(rawUrl, opts, true)
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
    captureScreenshot: boolean,
  ): Promise<FetchPageResult> {
    const url = parseAndValidateUrl(rawUrl)
    await assertHostnameSafe(url.hostname)

    const slot: PoolSlot = await this.pool.acquire()
    const executable = opts.executable || DEFAULT_EXECUTABLE
    const evalScript =
      '(() => { try { return document.documentElement.outerHTML } catch (_e) { return "" } })()'
    const b64 = Buffer.from(evalScript, 'utf8').toString('base64')

    // Shared wall budget. HTML batch consumes part of it; the screenshot
    // step (if any) gets the remainder, so the total time of HTML +
    // screenshot stays inside `opts.timeoutMs`.
    const started = Date.now()
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)
    let html: SafeFetchResult
    try {
      const { stdout } = await execFileAsync(
        executable,
        [
          '--session',
          slot.name,
          'batch',
          '--bail',
          '--json',
          `open ${url.toString()}`,
          'wait 1500',
          `eval -b ${b64} --json`,
        ],
        {
          signal: ac.signal,
          maxBuffer: Math.max(opts.maxBodyBytes * 2, 4_194_304),
          windowsHide: true,
          env: process.env,
        },
      )
      this.pool.markLive(slot)
      const rawHtml = extractHtmlFromBatchOutput(stdout)
      const truncated = rawHtml.length > opts.maxBodyBytes
      const body = truncated ? rawHtml.slice(0, opts.maxBodyBytes) : rawHtml
      html = {
        finalUrl: url.toString(),
        contentType: 'text/html',
        body,
        truncated,
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string }
      if (ac.signal.aborted) {
        // Timeout: pool keeps the slot — idle eviction will discard it
        // later if chromium is wedged.
        this.pool.release(slot)
        throw new Error(
          `agent-browser timed out after ${opts.timeoutMs}ms for ${url.toString()}`,
          { cause: error },
        )
      }
      // Non-timeout: discard the slot so a wedged chromium does not poison
      // the next caller.
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

    // Screenshot step. Runs as a SECOND `agent-browser` invocation against
    // the same named session so a failure cannot mask HTML success (the
    // `--bail` batch would have aborted on a sub-step failure and lost the
    // HTML result). We swallow all errors here and only log at `debug`.
    // Reached only on try-block success — `slot` still held, chromium live.
    let screenshotBytes: Buffer | undefined
    if (captureScreenshot) {
      // Floor at 500ms so a near-exhausted budget still gives the CLI a
      // realistic shot rather than passing 0 (AbortController fires
      // immediately on a zero timer in some Node versions).
      const remaining = Math.max(500, opts.timeoutMs - (Date.now() - started))
      screenshotBytes = await this.captureScreenshot(
        executable,
        slot.name,
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

  private async captureScreenshot(
    executable: string,
    sessionName: string,
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
            '--session',
            sessionName,
            'batch',
            '--bail',
            '--json',
            `set viewport ${SCREENSHOT_VIEWPORT_WIDTH} ${SCREENSHOT_VIEWPORT_HEIGHT}`,
            `screenshot --screenshot-format webp --screenshot-quality ${SCREENSHOT_CLI_QUALITY} --screenshot-dir ${dir}`,
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

      // The CLI's chosen filename is not stable across versions, so discover
      // it instead of hard-coding. Strict: expect exactly one `.webp` file.
      // Zero or many is treated as a screenshot failure so a surprising CLI
      // behavior shift surfaces here instead of silently picking one.
      const entries = await readdir(dir)
      const webpFiles = entries.filter((name) =>
        name.toLowerCase().endsWith('.webp'),
      )
      if (webpFiles.length !== 1) {
        this.logger.debug(
          `screenshot capture produced ${webpFiles.length} .webp files in ${dir}; expected 1`,
        )
        return undefined
      }
      return await readFile(join(dir, webpFiles[0]))
    } finally {
      // Best-effort tempdir cleanup. Failure is non-fatal.
      try {
        await rm(dir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }
}

/**
 * agent-browser `batch --json` prints a JSON array — one entry per sub-command.
 * The last entry corresponds to our `eval` and carries the evaluated value.
 * Output shape has shifted across versions, so we probe a few keys and fall
 * back to the raw stdout if nothing parses (defensive — a heavily-shifted
 * format would just return less useful HTML rather than crash the request).
 */
function extractHtmlFromBatchOutput(stdout: string): string {
  const trimmed = stdout.trim()
  if (!trimmed) return ''
  try {
    const parsed = JSON.parse(trimmed)
    const last = Array.isArray(parsed) ? parsed.at(-1) : parsed
    if (last && typeof last === 'object') {
      const candidate =
        pickStringField(last, 'value') ??
        pickStringField(last, 'result') ??
        pickStringField(last, 'data') ??
        (typeof (last as { output?: unknown }).output === 'string'
          ? (last as { output: string }).output
          : undefined)
      if (typeof candidate === 'string') return candidate
    }
    if (typeof parsed === 'string') return parsed
  } catch {
    // Not JSON — could be a heredoc or plain-text mode. Treat as HTML.
  }
  return trimmed
}

function pickStringField(obj: object, key: string): string | undefined {
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : undefined
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
