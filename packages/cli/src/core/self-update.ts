import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { satisfies, validRange } from 'semver'

export const PACKAGE_NAME = '@mx-space/cli'
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org'

export type PmKind = 'npm' | 'pnpm' | 'yarn' | 'bun'
export type Channel = 'stable' | 'next'

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
  {
    pm: 'bun',
    markers: ['/.bun/install/global/', '\\bun\\install\\global\\'],
  },
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

function normalizePath(p: string): string {
  return p.replaceAll('\\', '/').toLowerCase()
}

export function detectPackageManager(argv1: string): PmDetection {
  let real = argv1
  try {
    real = realpathSync(argv1)
  } catch {
    // keep original; fs.realpath may fail in tests with synthetic paths
  }
  const normalized = normalizePath(real)

  for (const d of DEV_FRAGMENTS) {
    if (
      d.markers.some((m) =>
        normalized.includes(m.replaceAll('\\', '/').toLowerCase()),
      )
    ) {
      return { kind: 'dev', reason: d.reason, realPath: real }
    }
  }

  for (const t of TRANSIENT_FRAGMENTS) {
    if (
      t.markers.some((m) =>
        normalized.includes(m.replaceAll('\\', '/').toLowerCase()),
      )
    ) {
      return { kind: 'transient', cache: t.cache, realPath: real }
    }
  }

  for (const p of PM_FRAGMENTS) {
    if (
      p.markers.some((m) =>
        normalized.includes(m.replaceAll('\\', '/').toLowerCase()),
      )
    ) {
      return { kind: 'global', pm: p.pm, realPath: real }
    }
  }

  // Default to npm if the path looks like a node_modules install but matched no other PM
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
  channel: Channel,
  opts: FetchOpts = {},
): Promise<RegistryHit | NotModified> {
  const registry = (opts.registry ?? DEFAULT_REGISTRY).replace(/\/+$/, '')
  const distTag = channel === 'next' ? 'next' : 'latest'
  const url = `${registry}/${encodeURIComponent(PACKAGE_NAME).replace('%40', '@')}/${distTag}`
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.etag) headers['if-none-match'] = opts.etag

  const fetchImpl: FetchImpl =
    (opts.fetchImpl as FetchImpl | undefined) ??
    ((url, init) => (globalThis.fetch as any)(url, init))

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

/**
 * Compares two semver-ish strings. Supports `X.Y.Z` and `X.Y.Z-pre.N`.
 * Returns -1, 0, or 1.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) {
    return a === b ? 0 : a < b ? -1 : 1
  }
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
  channel: Channel,
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

export async function spawnUpgrade(
  cmd: string,
  args: string[],
  opts: { cwd?: string } = {},
): Promise<SpawnUpgradeResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'pipe'],
      cwd: opts.cwd ?? process.cwd(),
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

/** Helper for resolving the runtime entrypoint that should be probed. */
export function resolveCliEntrypoint(): string {
  return process.argv[1] ?? ''
}

// `path` and `os` are intentionally imported for downstream consumers via re-export.
void path
