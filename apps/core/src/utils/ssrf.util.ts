import { lookup } from 'node:dns/promises'

import { Agent } from 'undici'

import { isDev } from '~/global/env.global'
import {
  assertHostnameSafe,
  isPrivateIp,
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
 * Requests must use publicHttpDispatcher so DNS is validated at connection time.
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

/** The checked DNS answers are the exact addresses handed to the socket. */
export const publicHttpDispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true, family: options.family }).then(
        (addresses) => {
          if (
            !addresses.length ||
            (!isDev &&
              addresses.some((entry) =>
                isPrivateIp(entry.address, entry.family),
              ))
          ) {
            callback(new UnsafeUrlError('Blocked outbound DNS address'), '', 0)
            return
          }
          callback(
            null,
            options.all ? addresses : addresses[0].address,
            addresses[0].family,
          )
        },
        (error) => callback(error, '', 0),
      )
    },
  },
})
