/**
 * Common validation utility functions to replace class-validator utilities
 */

/**
 * Check if value is defined (not null and not undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Check if value is a valid MongoDB ObjectId (24 hex characters)
 */
export function isMongoId(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^[a-f0-9]{24}$/i.test(value)
}

/**
 * Check if value is a valid URL with protocol
 */
export function isURL(
  value: unknown,
  options?: {
    require_protocol?: boolean
    protocols?: string[]
  },
): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    const protocol = url.protocol.replace(':', '')
    if (options?.protocols && options.protocols.length > 0) {
      return options.protocols.includes(protocol)
    }
    if (options?.require_protocol) {
      return protocol === 'http' || protocol === 'https'
    }
    return true
  } catch {
    return false
  }
}

/**
 * Check if value is a valid JWT token format
 * JWT consists of three base64url-encoded parts separated by dots
 */
export function isJWT(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const parts = value.split('.')
  if (parts.length !== 3) return false
  // Check if each part is valid base64url
  const base64urlRegex = /^[\w-]*$/
  return parts.every((part) => base64urlRegex.test(part) && part.length > 0)
}

/**
 * Check if value is a valid semver version
 */
export function isSemVer(value: unknown): boolean {
  if (typeof value !== 'string') return false
  // Match standard semver format: X.Y.Z with optional pre-release and build metadata
  // Using non-capturing groups since we only need to test, not extract
  const semverRegex =
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*)?(?:\+[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/i
  return semverRegex.test(value)
}
