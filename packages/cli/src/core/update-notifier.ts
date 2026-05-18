import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { getConfigDir } from './config-dir'
import {
  type Channel,
  compareSemver,
  type FetchImpl,
  fetchLatestVersion,
} from './self-update'

const CACHE_FILE = 'update-check.json'
const THROTTLE_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000

export interface CachedState {
  last_check_ts: number
  latest_version?: string
  etag?: string
}

export interface NotifyContext {
  currentVersion: string
  channel?: Channel
  quiet?: boolean
  json?: boolean
  output?: string
  commandName?: string
  parentName?: string
  force?: boolean
  // injectable for tests
  now?: () => number
  cwdHome?: string
  fetchImpl?: FetchImpl
  isTTY?: boolean
  env?: NodeJS.ProcessEnv
  emit?: (message: string) => void
  configDir?: string
}

function cachePath(ctx: NotifyContext): string {
  return path.join(ctx.configDir ?? getConfigDir(), CACHE_FILE)
}

export function readCache(
  ctx: NotifyContext = { currentVersion: '0.0.0' },
): CachedState | null {
  try {
    const raw = readFileSync(cachePath(ctx), 'utf8')
    const parsed = JSON.parse(raw) as CachedState
    if (typeof parsed?.last_check_ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function writeCacheAtomic(
  state: CachedState,
  ctx: NotifyContext = { currentVersion: '0.0.0' },
): void {
  const target = cachePath(ctx)
  const dir = path.dirname(target)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(state))
  renameSync(tmp, target)
}

export function shouldSkipNotify(ctx: NotifyContext): boolean {
  const env = ctx.env ?? process.env
  if (ctx.quiet || ctx.json) return true
  if (ctx.output === 'json') return true
  if (env.CI && env.CI !== '' && env.CI !== '0' && env.CI !== 'false')
    return true
  if (env.MXS_NO_UPDATE_CHECK === '1') return true
  if (ctx.isTTY === false) return true
  if (ctx.commandName === 'update') return true
  if (ctx.parentName === 'update') return true
  return false
}

function emitNotification(
  ctx: NotifyContext,
  current: string,
  latest: string,
): void {
  const msg = `mxs update available: ${current} → ${latest}   run 'mxs update' to upgrade`
  if (ctx.emit) {
    ctx.emit(msg)
    return
  }
  process.stderr.write(`${msg}\n`)
}

/**
 * Fire-and-forget update notifier. Never throws. Returns a promise that callers
 * may optionally await in tests; production code drops the promise on the floor.
 */
export async function maybeNotify(ctx: NotifyContext): Promise<void> {
  try {
    if (shouldSkipNotify(ctx)) return

    const now = (ctx.now ?? Date.now)()
    const cache = readCache(ctx)
    const channel: Channel =
      ctx.channel ?? readChannelFromEnv(ctx.env ?? process.env)

    // 1. If cache is fresh, just consult it
    if (cache && !ctx.force && now - cache.last_check_ts < THROTTLE_MS) {
      if (
        cache.latest_version &&
        compareSemver(ctx.currentVersion, cache.latest_version) < 0
      ) {
        emitNotification(ctx, ctx.currentVersion, cache.latest_version)
      }
      return
    }

    // 2. Re-query registry with a hard timeout. fire-and-forget.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    // Allow process to exit even if request is pending
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      ;(timer as { unref: () => void }).unref()
    }

    try {
      const hit = await fetchLatestVersion(channel, {
        etag: cache?.etag,
        signal: controller.signal,
        fetchImpl: ctx.fetchImpl,
      })
      clearTimeout(timer)

      if ('notModified' in hit && hit.notModified) {
        writeCacheAtomic(
          {
            last_check_ts: now,
            latest_version: cache?.latest_version,
            etag: cache?.etag,
          },
          ctx,
        )
        return
      }

      writeCacheAtomic(
        {
          last_check_ts: now,
          latest_version: hit.version,
          etag: hit.etag,
        },
        ctx,
      )
      // Intentionally do NOT print on this run; next run consults the cache and notifies.
    } catch {
      clearTimeout(timer)
      // Still update last_check_ts to avoid hammering broken networks
      writeCacheAtomic(
        {
          last_check_ts: now,
          latest_version: cache?.latest_version,
          etag: cache?.etag,
        },
        ctx,
      )
    }
  } catch {
    // never throw
  }
}

function readChannelFromEnv(env: NodeJS.ProcessEnv): Channel {
  const v = env.MXS_UPDATE_CHANNEL
  return v === 'next' ? 'next' : 'stable'
}

/**
 * Construct a NotifyContext from current process + global flags.
 */
export function buildContextFromFlags(input: {
  currentVersion: string
  flags: { quiet?: boolean; json?: boolean; output?: string }
  commandName?: string
  parentName?: string
  force?: boolean
}): NotifyContext {
  return {
    currentVersion: input.currentVersion,
    quiet: input.flags.quiet,
    json: input.flags.json,
    output: input.flags.output,
    commandName: input.commandName,
    parentName: input.parentName,
    force: input.force,
    isTTY: Boolean(process.stderr.isTTY),
    env: process.env,
  }
}

// Exit-cleanup support: nothing to expose for now.
