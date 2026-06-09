import { spawn } from 'node:child_process'
import {
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Context, Effect, Layer } from 'effect'
import { satisfies, validRange } from 'semver'

import {
  type Generic,
  UpdateDevEnvironment,
  UpdateNodeIncompatible,
  UpdatePermissionDenied,
  UpdatePmUnknown,
  UpdateRegistryUnreachable,
  UpdateSpawnFailed,
  UpdateTransientInstall,
} from '../domain/errors'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type UpdateChannel = 'stable' | 'next'
export type PmKind = 'npm' | 'pnpm' | 'yarn' | 'bun'

export const PACKAGE_NAME = '@mx-space/cli'
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const CACHE_FILE = 'update-check.json'
const THROTTLE_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000

export interface NotifyOptions {
  readonly currentVersion: string
  readonly channel?: UpdateChannel
  readonly quiet?: boolean
  readonly json?: boolean
  readonly output?: string
  readonly commandName?: string
  readonly parentName?: string
  readonly force?: boolean
  readonly isTTY?: boolean
  readonly env?: NodeJS.ProcessEnv
  readonly emit?: (message: string) => void
  readonly configDir?: string
}

export interface RunUpdateOptions {
  readonly currentVersion: string
  readonly channel?: UpdateChannel
  readonly dryRun?: boolean
  readonly check?: boolean
  readonly prerelease?: boolean
  readonly pm?: string
  readonly yes?: boolean
  readonly force?: boolean
  readonly json?: boolean
  /** Override `process.argv[1]` for pm detection (tests). */
  readonly entrypoint?: string
  /** Override Node version for engine compatibility check (tests). */
  readonly nodeVersion?: string
}

export interface RunUpdateResult {
  readonly fromVersion: string
  readonly toVersion: string
  readonly pm: PmKind | null
  readonly channel: UpdateChannel
  readonly status: number
  /** true when the package manager actually ran and succeeded. */
  readonly upgraded: boolean
  /** true when no install was performed (already up to date / --check / --dry-run / cancelled). */
  readonly dryRun: boolean
  /** true when local version >= registry latest. */
  readonly upToDate: boolean
  readonly command?: string
  readonly cancelled?: boolean
}

export type RunUpdateError =
  | UpdateDevEnvironment
  | UpdateTransientInstall
  | UpdatePmUnknown
  | UpdateRegistryUnreachable
  | UpdateNodeIncompatible
  | UpdateSpawnFailed
  | UpdatePermissionDenied
  | Generic

export interface UpdateNotifierService {
  readonly maybeNotify: (opts: NotifyOptions) => Effect.Effect<void>
  readonly runUpdate: (
    opts: RunUpdateOptions,
  ) => Effect.Effect<RunUpdateResult, RunUpdateError>
}

// ---------------------------------------------------------------------------
// Pure helpers (ported from `src/core/self-update.ts`)
// ---------------------------------------------------------------------------

export type PmDetection =
  | { kind: 'global'; pm: PmKind; realPath: string }
  | {
      kind: 'dev'
      reason: 'monorepo-source' | 'monorepo-dist'
      realPath: string
    }
  | { kind: 'transient'; cache: 'npx' | 'pnpm-dlx' | 'bunx'; realPath: string }
  | { kind: 'unknown'; realPath: string }

const PM_FRAGMENTS: Array<{ pm: PmKind; markers: string[] }> = [
  {
    pm: 'pnpm',
    markers: [
      '/pnpm/global/',
      '/library/pnpm/global/',
      '/.local/share/pnpm/global/',
      '\\pnpm\\global\\',
    ],
  },
  { pm: 'bun', markers: ['/.bun/install/global/', '\\bun\\install\\global\\'] },
  {
    pm: 'yarn',
    markers: ['/.config/yarn/global/', '/.yarn/global/', '\\yarn\\global\\'],
  },
]

const TRANSIENT_FRAGMENTS: Array<{
  cache: 'npx' | 'pnpm-dlx' | 'bunx'
  markers: string[]
}> = [
  { cache: 'npx', markers: ['/_npx/', '\\_npx\\'] },
  { cache: 'pnpm-dlx', markers: ['/.pnpm-store/dlx/', '/dlx-', '\\dlx-'] },
  {
    cache: 'bunx',
    markers: ['/.bun/install/cache/', '\\bun\\install\\cache\\'],
  },
]

const DEV_FRAGMENTS: Array<{
  reason: 'monorepo-source' | 'monorepo-dist'
  markers: string[]
}> = [
  {
    reason: 'monorepo-source',
    markers: ['/packages/cli/src/', '\\packages\\cli\\src\\'],
  },
  {
    reason: 'monorepo-dist',
    markers: ['/packages/cli/dist/', '\\packages\\cli\\dist\\'],
  },
]

const normalizePath = (p: string) => p.replaceAll('\\', '/').toLowerCase()

export function detectPackageManager(argv1: string): PmDetection {
  let real = argv1
  try {
    real = realpathSync(argv1)
  } catch {
    // keep original; fs.realpath may fail for synthetic paths
  }
  const normalized = normalizePath(real)
  const matches = (m: string) =>
    normalized.includes(m.replaceAll('\\', '/').toLowerCase())

  for (const d of DEV_FRAGMENTS) {
    if (d.markers.some(matches)) {
      return { kind: 'dev', reason: d.reason, realPath: real }
    }
  }
  for (const t of TRANSIENT_FRAGMENTS) {
    if (t.markers.some(matches)) {
      return { kind: 'transient', cache: t.cache, realPath: real }
    }
  }
  for (const p of PM_FRAGMENTS) {
    if (p.markers.some(matches)) {
      return { kind: 'global', pm: p.pm, realPath: real }
    }
  }
  if (
    /\/node_modules\/@mx-space\/cli\b/.test(normalized) ||
    /\/lib\/node_modules\/@mx-space\/cli\b/.test(normalized) ||
    /\/appdata\/roaming\/npm\/node_modules\/@mx-space\/cli\b/.test(normalized)
  ) {
    return { kind: 'global', pm: 'npm', realPath: real }
  }
  return { kind: 'unknown', realPath: real }
}

export interface RegistryHit {
  notModified?: false
  version: string
  engines?: { node?: string }
  tarball?: string
  etag?: string
}

export interface NotModified {
  notModified: true
  etag?: string
}

export type FetchImpl = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface FetchOpts {
  etag?: string
  signal?: AbortSignal
  registry?: string
  fetchImpl?: FetchImpl
}

export async function fetchLatestVersion(
  channel: UpdateChannel,
  opts: FetchOpts = {},
): Promise<RegistryHit | NotModified> {
  const registry = (opts.registry ?? DEFAULT_REGISTRY).replace(/\/+$/, '')
  const distTag = channel === 'next' ? 'next' : 'latest'
  const url = `${registry}/${encodeURIComponent(PACKAGE_NAME).replace('%40', '@')}/${distTag}`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.etag) headers['if-none-match'] = opts.etag
  const fetchImpl: FetchImpl =
    opts.fetchImpl ?? ((u, init) => (globalThis.fetch as any)(u, init))
  const res = await fetchImpl(url, { headers, signal: opts.signal })
  if (res.status === 304) {
    return { notModified: true, etag: opts.etag }
  }
  if (!res.ok) {
    throw new Error(`registry returned status ${res.status}`)
  }
  const body = (await res.json()) as {
    version: string
    engines?: { node?: string }
    dist?: { tarball?: string }
  }
  return {
    version: body.version,
    engines: body.engines,
    tarball: body.dist?.tarball,
    etag: res.headers.get('etag') ?? undefined,
  }
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return a === b ? 0 : a < b ? -1 : 1
  for (let i = 0; i < 3; i++) {
    if (pa.main[i] !== pb.main[i]) return pa.main[i] < pb.main[i] ? -1 : 1
  }
  if (!pa.pre && !pb.pre) return 0
  if (!pa.pre && pb.pre) return 1
  if (pa.pre && !pb.pre) return -1
  const ap = pa.pre as string[]
  const bp = pb.pre as string[]
  const n = Math.max(ap.length, bp.length)
  for (let i = 0; i < n; i++) {
    const x = ap[i]
    const y = bp[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x) ? Number(x) : null
    const yn = /^\d+$/.test(y) ? Number(y) : null
    if (xn !== null && yn !== null) {
      if (xn !== yn) return xn < yn ? -1 : 1
      continue
    }
    if (xn !== null) return -1
    if (yn !== null) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

function parseSemver(
  v: string,
): { main: [number, number, number]; pre: string[] | null } | null {
  const m =
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([\d.A-Za-z-]+))?(?:\+[\d.A-Za-z-]+)?$/.exec(
      v.trim(),
    )
  if (!m) return null
  return {
    main: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.') : null,
  }
}

export function satisfiesNodeEngine(
  currentVersion: string,
  range: string | undefined,
): boolean {
  if (!range) return true
  const trimmed = range.trim()
  if (!trimmed) return true
  if (!validRange(trimmed, { loose: true })) return true
  return satisfies(currentVersion, trimmed, { loose: true })
}

export function buildUpgradeCommand(
  pm: PmKind,
  channel: UpdateChannel,
): { cmd: string; args: string[] } {
  const target =
    channel === 'next' ? `${PACKAGE_NAME}@next` : `${PACKAGE_NAME}@latest`
  switch (pm) {
    case 'npm': {
      return { cmd: 'npm', args: ['install', '-g', target] }
    }
    case 'pnpm': {
      return { cmd: 'pnpm', args: ['add', '-g', target] }
    }
    case 'yarn': {
      return { cmd: 'yarn', args: ['global', 'add', target] }
    }
    case 'bun': {
      return { cmd: 'bun', args: ['add', '-g', target] }
    }
  }
}

export interface SpawnUpgradeResult {
  status: number
  stderr: string
}

async function defaultSpawnUpgrade(
  cmd: string,
  args: string[],
): Promise<SpawnUpgradeResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'pipe'],
      cwd: process.cwd(),
      shell: os.platform() === 'win32',
    })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      const str = chunk.toString()
      stderr += str
      process.stderr.write(chunk)
    })
    child.on('error', (err) => {
      stderr += String((err as Error).message ?? err)
      resolve({ status: 1, stderr })
    })
    child.on('exit', (code) => {
      resolve({ status: code ?? 1, stderr })
    })
  })
}

export type SpawnDetached = (
  cmd: string,
  args: string[],
  logPath: string,
) => void

function defaultSpawnDetached(
  cmd: string,
  args: string[],
  logPath: string,
): void {
  try {
    mkdirSync(path.dirname(logPath), { recursive: true })
  } catch {
    // ignore
  }
  let out: number
  try {
    out = openSync(logPath, 'a')
  } catch {
    out = openSync(os.platform() === 'win32' ? 'NUL' : '/dev/null', 'a')
  }
  try {
    const child = spawn(cmd, args, {
      stdio: ['ignore', out, out],
      cwd: process.cwd(),
      shell: os.platform() === 'win32',
      detached: true,
      env: { ...process.env, MXS_NO_UPDATE_CHECK: '1' },
    })
    child.on('error', () => {
      // Best-effort: child failed to spawn (e.g. pm not on PATH). Next mxs
      // invocation will emit the legacy notify line again after the 24h
      // throttle expires.
    })
    child.unref()
  } catch {
    // ignore: detached spawn is best-effort.
  }
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

export interface CachedState {
  last_check_ts: number
  latest_version?: string
  etag?: string
  /**
   * Timestamp of the most recent background auto-update spawn. Used to throttle
   * silent installs so a single new release doesn't trigger an `npm i -g` on
   * every `mxs <cmd>` invocation within the 24h check window.
   */
  last_auto_update_ts?: number
}

function defaultConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), '.config')
  return path.join(base, 'mxs')
}

function cachePath(configDir: string): string {
  return path.join(configDir, CACHE_FILE)
}

export function readCache(configDir: string): CachedState | null {
  try {
    const raw = readFileSync(cachePath(configDir), 'utf8')
    const parsed = JSON.parse(raw) as CachedState
    if (typeof parsed?.last_check_ts !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function writeCacheAtomic(state: CachedState, configDir: string): void {
  const target = cachePath(configDir)
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

export function shouldSkipNotify(opts: NotifyOptions): boolean {
  const env = opts.env ?? process.env
  if (opts.quiet || opts.json) return true
  if (opts.output === 'json') return true
  if (env.CI && env.CI !== '' && env.CI !== '0' && env.CI !== 'false')
    return true
  if (env.MXS_NO_UPDATE_CHECK === '1') return true
  if (opts.isTTY === false) return true
  if (opts.commandName === 'update') return true
  if (opts.parentName === 'update') return true
  return false
}

function readChannelFromEnv(env: NodeJS.ProcessEnv): UpdateChannel {
  return env.MXS_UPDATE_CHANNEL === 'next' ? 'next' : 'stable'
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export interface UpdateNotifierDeps {
  readonly now?: () => number
  readonly fetchImpl?: FetchImpl
  readonly spawnImpl?: (
    cmd: string,
    args: string[],
  ) => Promise<SpawnUpgradeResult>
  /**
   * Fire-and-forget detached spawn used by the background auto-update path.
   * Unit tests can inject a spy to verify that an install was triggered
   * without actually running the package manager.
   */
  readonly spawnDetached?: SpawnDetached
  /**
   * @deprecated The interactive confirm prompt was removed when `mxs update`
   * became auto-install by default. Accepted for backward compatibility with
   * older `make()` call sites; never invoked.
   */
  readonly confirmImpl?: (message: string) => Promise<boolean>
  readonly emitInfo?: (msg: string) => void
  readonly configDir?: string
  /**
   * Override `process.argv[1]` for the background auto-update path's pm
   * detection. Production callers leave this unset and the helper reads
   * argv directly.
   */
  readonly entrypoint?: string
}

const AUTO_UPDATE_LOG = 'auto-update.log'

const isAutoUpdateDisabled = (env: NodeJS.ProcessEnv): boolean =>
  env.MXS_NO_AUTO_UPDATE === '1' ||
  env.MXS_NO_AUTO_UPDATE === 'true' ||
  env.MXS_NO_AUTO_UPDATE === 'yes'

interface AutoUpdatePlan {
  readonly pm: PmKind
  readonly cmd: string
  readonly args: string[]
}

const planAutoUpdate = (
  entry: string,
  channel: UpdateChannel,
): AutoUpdatePlan | null => {
  const detection = detectPackageManager(entry)
  if (detection.kind !== 'global') return null
  const { cmd, args } = buildUpgradeCommand(detection.pm, channel)
  return { pm: detection.pm, cmd, args }
}

const KNOWN_PMS: ReadonlySet<PmKind> = new Set<PmKind>([
  'npm',
  'pnpm',
  'yarn',
  'bun',
])

export const make = (deps: UpdateNotifierDeps = {}): UpdateNotifierService => {
  const now = () => (deps.now ? deps.now() : Date.now())
  const fetchImpl = deps.fetchImpl
  const spawnImpl = deps.spawnImpl ?? defaultSpawnUpgrade
  const spawnDetached = deps.spawnDetached ?? defaultSpawnDetached
  const emitInfo =
    deps.emitInfo ?? ((msg: string) => process.stderr.write(`${msg}\n`))
  const baseConfigDir = deps.configDir

  const resolvedConfigDir = (opts: NotifyOptions) =>
    opts.configDir ?? baseConfigDir ?? defaultConfigDir()

  const triggerAutoUpdate = (
    opts: NotifyOptions,
    latest: string,
    cache: CachedState | null,
    dir: string,
    ts: number,
  ): boolean => {
    const env = opts.env ?? process.env
    if (isAutoUpdateDisabled(env)) return false
    if (
      cache?.last_auto_update_ts !== undefined &&
      ts - cache.last_auto_update_ts < THROTTLE_MS
    ) {
      return false
    }
    const channel: UpdateChannel =
      opts.channel ?? readChannelFromEnv(env)
    const entry = deps.entrypoint ?? process.argv[1] ?? ''
    const plan = planAutoUpdate(entry, channel)
    if (!plan) return false
    try {
      spawnDetached(plan.cmd, plan.args, path.join(dir, AUTO_UPDATE_LOG))
    } catch {
      return false
    }
    writeCacheAtomic(
      {
        last_check_ts: ts,
        latest_version: latest,
        etag: cache?.etag,
        last_auto_update_ts: ts,
      },
      dir,
    )
    return true
  }

  const maybeNotify = (opts: NotifyOptions): Effect.Effect<void> =>
    Effect.tryPromise({
      try: async () => {
        if (shouldSkipNotify(opts)) return
        const dir = resolvedConfigDir(opts)
        const ts = now()
        const cache = readCache(dir)
        const channel: UpdateChannel =
          opts.channel ?? readChannelFromEnv(opts.env ?? process.env)
        const emit =
          opts.emit ?? ((msg: string) => process.stderr.write(`${msg}\n`))

        if (cache && !opts.force && ts - cache.last_check_ts < THROTTLE_MS) {
          if (
            cache.latest_version &&
            compareSemver(opts.currentVersion, cache.latest_version) < 0
          ) {
            const triggered = triggerAutoUpdate(
              opts,
              cache.latest_version,
              cache,
              dir,
              ts,
            )
            emit(
              triggered
                ? `mxs: auto-updating ${opts.currentVersion} → ${cache.latest_version} in background (set MXS_NO_AUTO_UPDATE=1 to disable)`
                : `mxs update available: ${opts.currentVersion} → ${cache.latest_version}   run 'mxs update' to upgrade`,
            )
          }
          return
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        if (typeof (timer as { unref?: () => void }).unref === 'function') {
          ;(timer as { unref: () => void }).unref()
        }

        try {
          const hit = await fetchLatestVersion(channel, {
            etag: cache?.etag,
            signal: controller.signal,
            fetchImpl,
          })
          clearTimeout(timer)
          if ('notModified' in hit && hit.notModified) {
            writeCacheAtomic(
              {
                last_check_ts: ts,
                latest_version: cache?.latest_version,
                etag: cache?.etag,
              },
              dir,
            )
            return
          }
          writeCacheAtomic(
            {
              last_check_ts: ts,
              latest_version: hit.version,
              etag: hit.etag,
              last_auto_update_ts: cache?.last_auto_update_ts,
            },
            dir,
          )
          if (compareSemver(opts.currentVersion, hit.version) < 0) {
            const triggered = triggerAutoUpdate(
              opts,
              hit.version,
              {
                last_check_ts: ts,
                latest_version: hit.version,
                etag: hit.etag,
                last_auto_update_ts: cache?.last_auto_update_ts,
              },
              dir,
              ts,
            )
            if (triggered) {
              emit(
                `mxs: auto-updating ${opts.currentVersion} → ${hit.version} in background (set MXS_NO_AUTO_UPDATE=1 to disable)`,
              )
            }
          }
        } catch {
          clearTimeout(timer)
          writeCacheAtomic(
            {
              last_check_ts: ts,
              latest_version: cache?.latest_version,
              etag: cache?.etag,
            },
            dir,
          )
        }
      },
      catch: () => undefined,
    }).pipe(
      Effect.catchAll(() => Effect.void),
      Effect.catchAllDefect(() => Effect.void),
    )

  const runUpdate = (
    opts: RunUpdateOptions,
  ): Effect.Effect<RunUpdateResult, RunUpdateError> =>
    Effect.gen(function* () {
      const channel: UpdateChannel = opts.prerelease
        ? 'next'
        : (opts.channel ?? 'stable')

      // 1. Detect package manager
      const entry = opts.entrypoint ?? process.argv[1] ?? ''
      const detection = detectPackageManager(entry)
      let pm: PmKind

      if (opts.pm) {
        if (!KNOWN_PMS.has(opts.pm as PmKind)) {
          return yield* Effect.fail(
            new UpdatePmUnknown({
              message: `unknown package manager '${opts.pm}'`,
              hint: 'supported values: npm | pnpm | yarn | bun',
            }),
          )
        }
        pm = opts.pm as PmKind
      } else {
        switch (detection.kind) {
          case 'dev': {
            return yield* Effect.fail(
              new UpdateDevEnvironment({
                message:
                  'dev install detected; mxs is running from the monorepo source tree',
                hint: 'pull the repo with `git pull` and rebuild instead of self-updating',
              }),
            )
          }
          case 'transient': {
            return yield* Effect.fail(
              new UpdateTransientInstall({
                message: `mxs is running from a transient ${detection.cache} cache`,
                hint: 'install mxs globally first, e.g. `npm i -g @mx-space/cli` or `pnpm add -g @mx-space/cli`',
              }),
            )
          }
          case 'unknown': {
            return yield* Effect.fail(
              new UpdatePmUnknown({
                message:
                  'unable to detect the package manager that installed mxs',
                hint: 'pass --pm <npm|pnpm|yarn|bun> to override detection',
                details: { realPath: detection.realPath },
              }),
            )
          }
          case 'global': {
            pm = detection.pm
            break
          }
        }
      }

      // 2. Fetch latest
      const hit = yield* Effect.tryPromise({
        try: async () => {
          const result = await fetchLatestVersion(channel, { fetchImpl })
          if ('notModified' in result && result.notModified) {
            throw new Error('unexpected 304 without an etag')
          }
          return result
        },
        catch: (cause) =>
          new UpdateRegistryUnreachable({
            message: 'unable to reach the npm registry',
            hint: 'check your network connection or set MXS_NO_UPDATE_CHECK=1 to silence the notifier',
            details: { cause: cause instanceof Error ? cause.message : cause },
          }),
      })

      const cmp = compareSemver(opts.currentVersion, hit.version)
      if (cmp >= 0) {
        return {
          fromVersion: opts.currentVersion,
          toVersion: hit.version,
          pm,
          channel,
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: true,
        }
      }

      // 3. Node engine compatibility
      const nodeVersion = opts.nodeVersion ?? process.versions.node
      if (
        hit.engines?.node &&
        !satisfiesNodeEngine(nodeVersion, hit.engines.node)
      ) {
        return yield* Effect.fail(
          new UpdateNodeIncompatible({
            message: `mxs ${hit.version} requires Node ${hit.engines.node} (current: v${nodeVersion})`,
            hint: 'upgrade Node first, then re-run `mxs update`',
          }),
        )
      }

      // 4. Announce
      if (!opts.json) {
        emitInfo(
          `mxs: ${opts.currentVersion} → ${hit.version}  (channel: ${channel}, pm: ${pm})`,
        )
      }

      if (opts.check) {
        return {
          fromVersion: opts.currentVersion,
          toVersion: hit.version,
          pm,
          channel,
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: false,
        }
      }

      const { cmd, args } = buildUpgradeCommand(pm, channel)
      const shown = `${cmd} ${args.join(' ')}`

      if (opts.dryRun) {
        if (!opts.json) emitInfo(`mxs: would run: ${shown}`)
        return {
          fromVersion: opts.currentVersion,
          toVersion: hit.version,
          pm,
          channel,
          status: 0,
          upgraded: false,
          dryRun: true,
          upToDate: false,
          command: shown,
        }
      }

      // 5. Spawn (auto-install — the legacy confirm prompt was removed when
      //    `mxs update` became automatic; `opts.yes` is now a no-op kept for
      //    backward compat with older invocations).
      if (!opts.json) emitInfo(`mxs: running ${shown}`)

      const result = yield* Effect.tryPromise({
        try: () => spawnImpl(cmd, args),
        catch: (cause) =>
          new UpdateSpawnFailed({
            message: `failed to spawn ${cmd}`,
            details: { cause: cause instanceof Error ? cause.message : cause },
          }),
      })

      if (result.status === 0) {
        if (!opts.json) {
          emitInfo(
            `mxs: upgraded to ${hit.version}. Restart any long-running mxs process.`,
          )
        }
        return {
          fromVersion: opts.currentVersion,
          toVersion: hit.version,
          pm,
          channel,
          status: 0,
          upgraded: true,
          dryRun: false,
          upToDate: false,
          command: shown,
        }
      }

      if (/eacces|permission denied/i.test(result.stderr)) {
        return yield* Effect.fail(
          new UpdatePermissionDenied({
            message:
              'package manager could not write to the global install directory',
            hint: `rerun with elevated permissions, e.g. \`sudo ${shown}\``,
          }),
        )
      }

      return yield* Effect.fail(
        new UpdateSpawnFailed({
          message: `${cmd} exited with status ${result.status}`,
          hint: `rerun with \`mxs update --dry-run\` to inspect the exact command`,
        }),
      )
    })

  return { maybeNotify, runUpdate }
}

// ---------------------------------------------------------------------------
// Tag + Layer
// ---------------------------------------------------------------------------

export class UpdateNotifier extends Context.Tag('UpdateNotifier')<
  UpdateNotifier,
  UpdateNotifierService
>() {
  static Default: Layer.Layer<UpdateNotifier> = Layer.succeed(
    UpdateNotifier,
    make(),
  )
}

/** Build a custom UpdateNotifier layer (tests). */
export const layer = (
  deps: UpdateNotifierDeps = {},
): Layer.Layer<UpdateNotifier> => Layer.succeed(UpdateNotifier, make(deps))
