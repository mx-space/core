export function isNewerVersion(current: string, latest: string): boolean {
  if (!isComparableVersion(current) || !isComparableVersion(latest)) {
    return false
  }

  const [currentBase, currentPre] = splitVersion(stripVersionPrefix(current))
  const [latestBase, latestPre] = splitVersion(stripVersionPrefix(latest))
  const currentParts = currentBase.split('.').map(Number)
  const latestParts = latestBase.split('.').map(Number)

  const maxLength = Math.max(currentParts.length, latestParts.length)
  for (let index = 0; index < maxLength; index++) {
    const currentPart = currentParts[index] || 0
    const latestPart = latestParts[index] || 0

    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }

  if (!latestPre && currentPre) return true
  if (latestPre && !currentPre) return false

  if (latestPre && currentPre) {
    return comparePrereleaseVersion(currentPre, latestPre)
  }

  return false
}

function isComparableVersion(version: string) {
  return /^\s*v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?\s*$/.test(version)
}

function stripVersionPrefix(version: string) {
  return version.trim().replace(/^v/, '')
}

function splitVersion(version: string): [string, string] {
  const hyphenIndex = version.indexOf('-')
  if (hyphenIndex === -1) return [version, '']

  return [version.slice(0, hyphenIndex), version.slice(hyphenIndex + 1)]
}

function comparePrereleaseVersion(current: string, latest: string): boolean {
  const order = ['alpha', 'beta', 'rc']
  const currentType = order.find((type) => current.startsWith(type))
  const latestType = order.find((type) => latest.startsWith(type))

  if (currentType && latestType && currentType !== latestType) {
    return order.indexOf(latestType) > order.indexOf(currentType)
  }

  const currentNumber = extractNumber(current)
  const latestNumber = extractNumber(latest)

  if (currentNumber !== null && latestNumber !== null) {
    return latestNumber > currentNumber
  }

  return latest > current
}

function extractNumber(value: string): number | null {
  const match = value.match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}
