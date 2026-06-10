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
  let protocol: string
  try {
    protocol = new URL(value).protocol.replace(':', '')
  } catch {
    return false
  }
  if (options?.protocols?.length) return options.protocols.includes(protocol)
  if (options?.require_protocol)
    return protocol === 'http' || protocol === 'https'
  return true
}

/**
 * Check if value is a valid semver version
 */
export function isSemVer(value: unknown): boolean {
  if (typeof value !== 'string') return false
  // Match standard semver format: X.Y.Z with optional pre-release and build metadata
  // Using non-capturing groups since we only need to test, not extract
  const semverRegex =
    /^(?:(?:0|[1-9]\d*)\.){2}(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-z-][\da-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][\da-z-]*))*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i
  return semverRegex.test(value)
}
