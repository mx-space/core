import { randomBytes } from 'node:crypto'
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/** Resolve a persistent local key only when a development build has no explicit key. */
export function resolveDevelopmentEncryptionKey(
  configuredKey: string,
  development: boolean,
  directory: string,
): string {
  if (configuredKey || !development) return configuredKey
  const keyFile = join(directory, 'dev-encryption.key')
  try {
    return readFileSync(keyFile, 'utf8').trim()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temporary = mkdtempSync(join(directory, '.dev-encryption-'))
  try {
    const candidate = join(temporary, 'key')
    writeFileSync(candidate, randomBytes(32).toString('hex'), {
      flag: 'wx',
      mode: 0o600,
    })
    try {
      // Publish a complete key atomically; concurrent workers reuse the winner.
      linkSync(candidate, keyFile)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  } finally {
    rmSync(temporary, { recursive: true })
  }
  return readFileSync(keyFile, 'utf8').trim()
}
