import {
  assertHostnameSafe,
  parseAndValidateUrl,
  UnsafeUrlError,
} from '~/processors/agent-browser/url-guard'

export {
  isPrivateIp,
  UnsafeUrlError,
} from '~/processors/agent-browser/url-guard'

export interface AssertPublicHttpUrlOptions {
  /**
   * Allow `http:` targets. Defaults to `false` — only `https:` is accepted.
   * Outbound fetches of remote, attacker-influenced URLs (friend-link avatars)
   * should stay on https; flip this on only for callers that legitimately need
   * cleartext.
   */
  allowHttp?: boolean
}

/**
 * SSRF guard for outbound fetches of user/applicant-supplied URLs.
 *
 * Validates the scheme, then resolves the hostname via `dns.lookup({ all:true })`
 * and rejects any target that points at loopback / link-local (incl.
 * 169.254.169.254 cloud metadata) / RFC1918 / CGNAT / IPv6 ULA + link-local /
 * IPv4-mapped addresses. Delegates the range checks to `url-guard.ts` so there
 * is a single source of truth shared with the agent-browser and Open Graph
 * fetchers.
 *
 * NOTE (DNS rebinding): this is a TOCTOU check. A rebinding attacker can pass
 * the lookup here and then re-point the hostname before the HTTP socket
 * connects. Callers MUST additionally disable redirect following
 * (`maxRedirects: 0`) to remove the redirect-based bypass. Fully closing the
 * rebinding window would require pinning the connection to the resolved IP.
 */
export async function assertPublicHttpUrl(
  rawUrl: string,
  options: AssertPublicHttpUrlOptions = {},
): Promise<URL> {
  const url = parseAndValidateUrl(rawUrl)
  if (!options.allowHttp && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Disallowed protocol: ${url.protocol}`)
  }
  await assertHostnameSafe(url.hostname)
  return url
}
