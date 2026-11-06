import { applyPatch, createPatch } from 'diff'

const PATCH_FILE = 'file'

export const AGENT_CONTEXT_MISSING = 'CONTEXT_MISSING'
export const AGENT_FILE_BASE_MISMATCH = 'FILE_BASE_MISMATCH'

export const FULL_RESULT_TOOLS: readonly string[] = [
  'preview_dynamic_component',
]

export async function hashAgentText(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalize((value as Record<string, unknown>)[key]),
        ]),
    )
  }
  return value
}

export function hashAgentValue(value: unknown): Promise<string> {
  return hashAgentText(JSON.stringify(canonicalize(value)))
}

export function createFilePatch(base: string, next: string): string {
  return createPatch(PATCH_FILE, base, next, '', '', { context: 0 })
}

export function applyFilePatch(base: string, patch: string): string | null {
  const result = applyPatch(base, patch)
  return result === false ? null : result
}
