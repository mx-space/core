import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { isDev } from '~/global/env.global'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
])

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal']

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export function parseAndValidateUrl(raw: string): URL {
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
  if (isDev) return url
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new UnsafeUrlError(`Blocked hostname: ${host}`)
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError(`Blocked hostname suffix: ${host}`)
  }
  const stripped = stripIpv6Brackets(host)
  const ipKind = isIP(stripped)
  if (ipKind !== 0 && isPrivateIp(stripped, ipKind)) {
    throw new UnsafeUrlError(`Private IP literal: ${host}`)
  }
  return url
}

export async function assertHostnameSafe(hostname: string): Promise<void> {
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

export function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1)
  return host
}

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
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(addr: string): boolean {
  const lower = addr.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  const v4mapped = /^:{2}f{4}:((?:\d+\.){3}\d+)$/i.exec(addr)
  if (v4mapped) return isPrivateIpv4(v4mapped[1])
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('ff')) return true
  return false
}
