import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { Injectable, Logger } from '@nestjs/common'

import {
  AGENT_BROWSER_DEFAULT_ACCEPT_LANGUAGE,
  AGENT_BROWSER_DEFAULT_LAUNCH_ARGS,
  AGENT_BROWSER_DEFAULT_NETWORKIDLE_MS,
  AGENT_BROWSER_DEFAULT_UA,
} from './agent-browser.constants'
import {
  AgentBrowserSessionPool,
  type PoolSlot,
} from './agent-browser-pool.service'
import {
  assertHostnameSafe,
  parseAndValidateUrl,
  UnsafeUrlError,
} from './url-guard'

const execFileAsync = promisify(execFile)

export interface CheckUrlOptions {
  timeoutMs?: number
  /** Override the executable path; defaults to the pool executable. */
  executable?: string
  /** Override the wait-for-networkidle budget. */
  networkidleMs?: number
}

export interface CheckUrlResult {
  ok: boolean
  /** Final document HTTP status as observed by chromium. `null` if navigation failed before any response. */
  status: number | null
  finalUrl?: string
  /** Diagnostic when `ok` is false. */
  error?: string
}

const PAGE_HREF_SCRIPT = '(() => window.location.href)()'
const PAGE_HREF_B64 = Buffer.from(PAGE_HREF_SCRIPT, 'utf8').toString('base64')

/**
 * Generic agent-browser primitive layer. Wraps `AgentBrowserSessionPool` to
 * expose high-level reachability checks consumable by feature modules
 * (friend-link health, etc.) without leaking pool semantics.
 *
 * Process safety: every command path that acquires a slot owns the eventual
 * `release` — successful release schedules idle close, error release passes
 * `discard:true` so a wedged chromium is torn down promptly. The pool's
 * own onModuleDestroy guarantees no leftover processes on shutdown.
 */
@Injectable()
export class AgentBrowserService {
  private readonly logger = new Logger(AgentBrowserService.name)

  constructor(private readonly pool: AgentBrowserSessionPool) {}

  /**
   * Probe a URL with a headless chromium and report the final document HTTP
   * status. Replaces the naive axios-GET fetch used to be in friend-link
   * health checks — handles JS-rendered landing pages, Cloudflare challenges
   * (best effort), and client-side redirects.
   */
  async checkUrl(
    rawUrl: string,
    opts: CheckUrlOptions = {},
  ): Promise<CheckUrlResult> {
    let url: URL
    try {
      url = parseAndValidateUrl(rawUrl)
      await assertHostnameSafe(url.hostname)
    } catch (error) {
      const err = error as Error
      return {
        ok: false,
        status: null,
        error:
          err instanceof UnsafeUrlError
            ? err.message
            : `Invalid URL: ${rawUrl}`,
      }
    }

    const executable = opts.executable || this.pool.executableName
    const timeoutMs = Math.max(1_000, opts.timeoutMs ?? 15_000)
    const networkidleMs =
      opts.networkidleMs ?? AGENT_BROWSER_DEFAULT_NETWORKIDLE_MS

    const slot = await this.pool.acquire()
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)

    let releaseAsDiscard = false
    try {
      const baseArgs = this.buildBaseArgs(slot)
      const finalUrl = await this.runNavigation(
        executable,
        baseArgs,
        url,
        networkidleMs,
        ac,
      )
      this.pool.markLive(slot)

      const documentStatus = await this.queryFinalDocumentStatus(
        executable,
        baseArgs,
        url,
        ac,
      )
      const status = documentStatus ?? 200
      const ok = status >= 200 && status < 400
      return { ok, status, finalUrl: finalUrl || url.toString() }
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string }
      if (ac.signal.aborted) {
        return {
          ok: false,
          status: null,
          error: `agent-browser timed out after ${timeoutMs}ms`,
        }
      }
      if (err.code === 'ENOENT') {
        // executable not installed — surface clearly so ops can fix it
        this.logger.warn(
          `agent-browser executable not found at "${executable}"`,
        )
        return {
          ok: false,
          status: null,
          error: `agent-browser not installed (${executable})`,
        }
      }
      // Likely chromium-side failure (DNS, TLS, refused). Discard the slot so
      // a wedged session does not poison the next caller.
      releaseAsDiscard = true
      return {
        ok: false,
        status: null,
        error: err.message || 'agent-browser navigation failed',
      }
    } finally {
      clearTimeout(timer)
      this.pool.release(slot, releaseAsDiscard ? { discard: true } : undefined)
    }
  }

  private buildBaseArgs(slot: PoolSlot): string[] {
    return [
      '--session',
      slot.name,
      '--user-agent',
      AGENT_BROWSER_DEFAULT_UA,
      '--headers',
      JSON.stringify({
        'Accept-Language': AGENT_BROWSER_DEFAULT_ACCEPT_LANGUAGE,
      }),
      '--args',
      AGENT_BROWSER_DEFAULT_LAUNCH_ARGS,
    ]
  }

  private async runNavigation(
    executable: string,
    baseArgs: string[],
    url: URL,
    networkidleMs: number,
    ac: AbortController,
  ): Promise<string> {
    const { stdout } = await execFileAsync(
      executable,
      [
        ...baseArgs,
        'batch',
        '--bail',
        '--json',
        `open ${url.toString()}`,
        `wait --load networkidle --timeout ${networkidleMs}`,
        `eval -b ${PAGE_HREF_B64}`,
      ],
      {
        signal: ac.signal,
        maxBuffer: 1_048_576,
        windowsHide: true,
        env: process.env,
      },
    )
    return extractEvalString(stdout)
  }

  private async queryFinalDocumentStatus(
    executable: string,
    baseArgs: string[],
    url: URL,
    ac: AbortController,
  ): Promise<number | null> {
    const hostGlob = `${url.protocol}//${url.hostname}/**`
    let stdout: string
    try {
      const res = await execFileAsync(
        executable,
        [
          ...baseArgs,
          'network',
          'requests',
          '--filter',
          hostGlob,
          '--type',
          'document',
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
    const last = parsed.at(-1) as { status?: unknown } | undefined
    const status = typeof last?.status === 'number' ? last.status : NaN
    return Number.isFinite(status) ? status : null
  }
}

function extractEvalString(stdout: string): string {
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
