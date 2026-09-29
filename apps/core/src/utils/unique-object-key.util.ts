import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { customAlphabet } from 'nanoid'

const suffix = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)
const MAX_PROBES = 5

function withSuffix(key: string, value: string) {
  const ext = path.posix.extname(key)
  return `${key.slice(0, key.length - ext.length)}-${value}${ext}`
}

export async function resolveUniqueObjectKey(
  key: string,
  exists: (key: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(key))) return key
  for (let i = 0; i < MAX_PROBES; i++) {
    const candidate = withSuffix(key, suffix())
    if (!(await exists(candidate))) return candidate
  }
  return withSuffix(key, randomUUID())
}
