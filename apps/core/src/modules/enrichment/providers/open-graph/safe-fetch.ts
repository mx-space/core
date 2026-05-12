import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { isDev } from '~/global/env.global'

const MAX_REDIRECTS = 5
// Pose as a current Chrome on macOS. Self-identifying "bot" UAs (the previous
// default) are routinely blocked by Cloudflare/Akamai/Vercel firewall rules,
// even for unauthenticated metadata reads. Browser-shaped UA + matching
// Sec-Fetch / sec-ch-ua hints get past the cheapest heuristics.
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SEC_CH_UA =
  '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
])

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal']

export interface SafeFetchOptions {
  timeoutMs: number
  maxBodyBytes: number
  acceptContentTypes?: readonly string[]
  userAgent?: string
}

export interface SafeFetchResult {
  finalUrl: string
  contentType: string
  body: string
  truncated: boolean
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export class FetchSizeExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`Response body exceeded limit ${limit} bytes`)
    this.name = 'FetchSizeExceededError'
  }
}

/**
 * Hardened HTTP fetcher for arbitrary user-supplied URLs. Defends against:
 *
 * - non-http(s) schemes
 * - private/loopback/link-local DNS resolution (best-effort; TOCTOU window)
 * - oversized response bodies (streamed truncation)
 * - slow / hung peers (AbortSignal timeout)
 * - redirect loops + cross-host redirects to internal targets
 *
 * Returns body as string capped at `maxBodyBytes`. Content-type is matched
 * loosely against `acceptContentTypes` prefixes (e.g. `text/html`).
 */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const accept = opts.acceptContentTypes ?? ['text/html', 'application/xhtml']

  let currentUrl = rawUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = parseAndValidateUrl(currentUrl)
    if (!isDev) await assertHostnameSafe(parsed.hostname)

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)

    let res: Response
    try {
      res = await fetch(parsed, {
        method: 'GET',
        redirect: 'manual',
        signal: ac.signal,
        headers: buildRequestHeaders(accept, opts.userAgent ?? DEFAULT_UA, hop),
      })
    } finally {
      clearTimeout(timer)
    }

    if (isRedirect(res.status)) {
      const loc = res.headers.get('location')
      if (!loc)
        throw new Error(`Redirect without location header (${res.status})`)
      try {
        await res.body?.cancel()
      } catch {
        // ignore — the body will be GC'd
      }
      currentUrl = new URL(loc, parsed).toString()
      continue
    }

    if (!res.ok) {
      try {
        await res.body?.cancel()
      } catch {
        // ignore
      }
      throw new Error(`HTTP ${res.status} for ${parsed.toString()}`)
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (!accept.some((prefix) => contentType.startsWith(prefix))) {
      try {
        await res.body?.cancel()
      } catch {
        // ignore
      }
      throw new Error(`Unsupported content-type: ${contentType || '∅'}`)
    }

    const { body, truncated } = await readWithLimit(res, opts.maxBodyBytes)
    return {
      finalUrl: parsed.toString(),
      contentType,
      body,
      truncated,
    }
  }

  throw new Error(`Too many redirects (>${MAX_REDIRECTS}) for ${rawUrl}`)
}

/**
 * Compose request headers shaped like a real Chrome navigation when the caller
 * expects HTML (Open Graph fallback), and like an XHR JSON request for
 * everything else (oEmbed). Anti-bot stacks key off the *combination* of UA,
 * Accept, Sec-Fetch-* and sec-ch-ua, so we keep them consistent rather than
 * just swapping the UA string.
 */
function buildRequestHeaders(
  accept: readonly string[],
  userAgent: string,
  hop: number,
): Record<string, string> {
  const isHtml = accept.some((p) => p.startsWith('text/html'))
  if (isHtml) {
    return {
      'User-Agent': userAgent,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Ch-Ua': SEC_CH_UA,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': hop === 0 ? 'none' : 'cross-site',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }
  }
  return {
    'User-Agent': userAgent,
    Accept: accept.length ? `${accept.join(', ')}, */*;q=0.1` : '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': SEC_CH_UA,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
}

function parseAndValidateUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Disallowed protocol: ${url.protocol}`)
  }
  const host = url.hostname.toLowerCase()
  if (!host) throw new UnsafeUrlError('Empty hostname')
  // Dev escape hatch: skip private-network guards so local proxies that
  // route public domains through fake-IP / RFC2544 ranges (e.g. Surge's
  // 198.18/15 enhanced-mode pool) can still resolve through this fetcher.
  if (isDev) return url
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new UnsafeUrlError(`Blocked hostname: ${host}`)
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError(`Blocked hostname suffix: ${host}`)
  }
  const ipKind = isIP(stripIpv6Brackets(host))
  if (ipKind !== 0 && isPrivateIp(stripIpv6Brackets(host), ipKind)) {
    throw new UnsafeUrlError(`Private IP literal: ${host}`)
  }
  return url
}

async function assertHostnameSafe(hostname: string): Promise<void> {
  // Skip DNS lookup for IP literals (already validated in parse step).
  if (isIP(stripIpv6Brackets(hostname)) !== 0) return

  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(hostname, { all: true })
  } catch (error) {
    throw new UnsafeUrlError(
      `DNS lookup failed for ${hostname}: ${(error as Error).message}`,
    )
  }
  if (addrs.length === 0) {
    throw new UnsafeUrlError(`No DNS records for ${hostname}`)
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address, a.family === 4 ? 4 : 6)) {
      throw new UnsafeUrlError(
        `Hostname ${hostname} resolves to private/internal IP ${a.address}`,
      )
    }
  }
}

function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1)
  return host
}

function isRedirect(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  )
}

async function readWithLimit(
  res: Response,
  limit: number,
): Promise<{ body: string; truncated: boolean }> {
  const contentLength = Number(res.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > limit) {
    try {
      await res.body?.cancel()
    } catch {
      // ignore
    }
    throw new FetchSizeExceededError(limit)
  }

  const reader = res.body?.getReader()
  if (!reader) return { body: '', truncated: false }

  const decoder = new TextDecoder('utf-8', { fatal: false })
  const chunks: string[] = []
  let total = 0
  let truncated = false
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        // Decode whatever fits then stop. Prevents oversized allocs.
        const overflow = total - limit
        const keep = value.byteLength - overflow
        if (keep > 0)
          chunks.push(decoder.decode(value.subarray(0, keep), { stream: true }))
        truncated = true
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        break
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
  return { body: chunks.join(''), truncated }
}

/**
 * IPv4: blocks loopback (127/8), private (10/8, 172.16/12, 192.168/16),
 * link-local (169.254/16), CGNAT (100.64/10), broadcast (255.255.255.255),
 * "this network" (0/8) and multicast (224/4).
 *
 * IPv6: blocks loopback (::1), unspecified (::), link-local (fe80::/10),
 * unique-local (fc00::/7), IPv4-mapped private equivalents, and multicast.
 */
export function isPrivateIp(addr: string, family: number): boolean {
  if (family === 4) return isPrivateIpv4(addr)
  if (family === 6) return isPrivateIpv6(addr)
  return true
}

function isPrivateIpv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number(p))
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true // 192.0.0.0/24, 192.0.2.0/24 doc range
  if (a === 198 && (b === 18 || b === 19)) return true // benchmark
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast + reserved
  return false
}

function isPrivateIpv6(addr: string): boolean {
  const lower = addr.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  // IPv4-mapped — re-check as v4.
  const v4mapped = /^:{2}f{4}:((?:\d+\.){3}\d+)$/i.exec(addr)
  if (v4mapped) return isPrivateIpv4(v4mapped[1])
  // fe80::/10 link-local, fc00::/7 unique-local, ff00::/8 multicast.
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('ff')) return true
  return false
}
