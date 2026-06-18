import fs from 'node:fs/promises'
import path from 'node:path'

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.DS_Store',
])

export function normalizeRemotePrefix(prefix: string) {
  const normalized = prefix.replaceAll(/^\/+|\/+$/g, '')
  return normalized ? `${normalized}/` : ''
}

export function detectSnippetType(remotePath: string, raw: string) {
  if (remotePath.endsWith('/SKILL.md') && raw.startsWith('---\n')) {
    return 'skill'
  }
  if (remotePath.endsWith('.json')) return 'json'
  if (remotePath.endsWith('.json5')) return 'json5'
  if (remotePath.endsWith('.yaml') || remotePath.endsWith('.yml')) return 'yaml'
  return 'text'
}

export async function walkTextFiles(root: string) {
  const files: string[] = []

  async function visit(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  await visit(root)
  return files.sort()
}

export function toRemotePath(prefix: string, localRoot: string, file: string) {
  const relative = path.relative(localRoot, file).split(path.sep).join('/')
  return `${normalizeRemotePrefix(prefix)}${relative}`
}

export function toLocalPath(
  localRoot: string,
  prefix: string,
  remotePath: string,
) {
  const normalizedPrefix = normalizeRemotePrefix(prefix)
  const relative = normalizedPrefix
    ? remotePath.slice(normalizedPrefix.length)
    : remotePath
  return path.join(localRoot, ...relative.split('/'))
}
