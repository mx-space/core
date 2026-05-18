import { createRequire } from 'node:module'
import { arch, platform, release } from 'node:os'

// `import.meta.url` resolves to one of:
//   `<root>/packages/cli/src/.../*.ts`     (tsx, dev)
//   `<root>/packages/cli/dist/*.mjs`       (bundled)
//   `<root>/packages/cli/dist/bin/*.mjs`   (bin shim)
// Walk up until we find the @mx-space/cli package.json.

const requireFrom = createRequire(import.meta.url)

const resolveCliVersion = (): string => {
  const candidates = [
    '../package.json',
    '../../package.json',
    '../../../package.json',
  ]
  for (const candidate of candidates) {
    try {
      const pkg = requireFrom(candidate) as {
        name?: string
        version?: string
      }
      if (pkg.name === '@mx-space/cli' && typeof pkg.version === 'string') {
        return pkg.version
      }
    } catch {
      // try next candidate
    }
  }
  return '0.0.0-unknown'
}

export const CLI_VERSION = resolveCliVersion()

/**
 * RFC-7231-style User-Agent. Format:
 *   `mxs/<cli-version> (<os-platform> <os-arch>; node/<node-version>)`
 *
 * Example: `mxs/0.4.0 (darwin arm64; node/v22.22.2)`
 *
 * mx-core's spider guard whitelists any UA containing `mx-space`; this string
 * does (`mxs` is the @mx-space/cli binary). Authenticated requests bypass the
 * guard regardless of UA, but a well-formed UA helps server-side analytics
 * tell agent traffic apart from human browser sessions.
 */
export const USER_AGENT = `mxs/${CLI_VERSION} (${platform()} ${arch()}; node/${process.version}) @mx-space/cli`

// `release()` is exposed for future enrichment (build/dist channel) — kept off
// the default UA to avoid leaking host detail unnecessarily.
export const HOST_KERNEL_RELEASE = release
