/** Draft-native fields; everything else rides along in `typeSpecificData`. */
const DRAFT_CORE_KEYS = new Set([
  'title',
  'text',
  'content',
  'contentFormat',
  'meta',
])

export type DraftRefType = 'post' | 'note' | 'page'

export const REF_TYPE_TO_RESOURCE: Record<DraftRefType, string> = {
  post: 'posts',
  note: 'notes',
  page: 'pages',
}

export interface DraftRow {
  id?: string
  refType?: DraftRefType
  refId?: string | null
  title?: string
  text?: string
  content?: string | null
  contentFormat?: string
  meta?: Record<string, unknown> | null
  typeSpecificData?: Record<string, unknown> | string | null
}

export const splitDraftBody = (
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const draftBody: Record<string, unknown> = {}
  const typeSpecificData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (DRAFT_CORE_KEYS.has(key)) draftBody[key] = value
    else typeSpecificData[key] = value
  }
  if (Object.keys(typeSpecificData).length > 0) {
    draftBody.typeSpecificData = typeSpecificData
  }
  return draftBody
}

export const parseTypeSpecificData = (
  raw: DraftRow['typeSpecificData'],
): Record<string, unknown> => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * The response interceptor snake_cases keys at every depth, but the request
 * pipe only camelizes the body's top level — nested subtrees (like `meta`)
 * must be restored before being sent back, or `skillIds` round-trips into a
 * stored `skill_ids`. Best-effort inverse: keys that legitimately contained
 * underscores were already mangled by the response side.
 */
export const camelizeDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(camelizeDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.replaceAll(/_([\da-z])/g, (_, c: string) => c.toUpperCase()),
        camelizeDeep(v),
      ]),
    )
  }
  return value
}

/** The server serializes response keys to snake_case; normalize back. */
export const normalizeDraftRow = (row: unknown): DraftRow => {
  if (!row || typeof row !== 'object') return {}
  const r = row as Record<string, unknown>
  const pick = <T>(camel: string, snake: string): T | undefined =>
    (r[camel] ?? r[snake]) as T | undefined
  return {
    id: pick('id', 'id'),
    refType: pick('refType', 'ref_type'),
    refId: pick('refId', 'ref_id'),
    title: pick('title', 'title'),
    text: pick('text', 'text'),
    content: pick('content', 'content'),
    contentFormat: pick('contentFormat', 'content_format'),
    meta: pick('meta', 'meta'),
    typeSpecificData: pick('typeSpecificData', 'type_specific_data'),
  }
}

/** Single-object responses may arrive wrapped in an outer `data` envelope. */
export const unwrapData = <T>(res: unknown): T => {
  if (res && typeof res === 'object' && 'data' in res) {
    const inner = (res as { data?: unknown }).data
    if (inner && typeof inner === 'object') return inner as T
  }
  return res as T
}
