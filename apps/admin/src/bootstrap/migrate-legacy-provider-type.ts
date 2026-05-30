// One-shot localStorage migration for the AI provider type enum collapse
// (step-19): legacy values `openai` and `openrouter` no longer exist; both
// must be rewritten to `openai-compatible`. Runs once at admin boot before
// React mounts, so any cached form drafts, settings snapshots, or persisted
// providers stay valid against the trimmed `AIProviderType` union.

const SENTINEL_KEY = '__mx_admin_migrated_ai_provider_type__'
const SENTINEL_VERSION = '1'

const LEGACY_VALUES = new Set(['openai', 'openrouter'])
const NEW_VALUE = 'openai-compatible'

export function migrateLegacyProviderType(
  storage: Storage = window.localStorage,
): void {
  try {
    if (storage.getItem(SENTINEL_KEY) === SENTINEL_VERSION) return
  } catch {
    return
  }

  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key) keys.push(key)
  }

  for (const key of keys) {
    const raw = storage.getItem(key)
    if (!raw) continue
    if (!raw.includes('openai') && !raw.includes('openrouter')) continue

    const rewritten = rewriteValue(raw)
    if (rewritten !== null && rewritten !== raw) {
      try {
        storage.setItem(key, rewritten)
      } catch {
        // best-effort migration; ignore storage write failures
      }
    }
  }

  try {
    storage.setItem(SENTINEL_KEY, SENTINEL_VERSION)
  } catch {
    // ignore
  }
}

function rewriteValue(raw: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const next = rewriteNode(parsed)
  if (next === parsed) return raw

  try {
    return JSON.stringify(next)
  } catch {
    return null
  }
}

function rewriteNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((entry) => {
      const rewritten = rewriteNode(entry)
      if (rewritten !== entry) changed = true
      return rewritten
    })
    return changed ? next : value
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(source)) {
      if (
        key === 'type' &&
        typeof entry === 'string' &&
        LEGACY_VALUES.has(entry)
      ) {
        next[key] = NEW_VALUE
        changed = true
        continue
      }
      const rewritten = rewriteNode(entry)
      if (rewritten !== entry) changed = true
      next[key] = rewritten
    }
    return changed ? next : value
  }
  return value
}
