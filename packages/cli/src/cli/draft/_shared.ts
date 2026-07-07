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

/** Single-object responses may arrive wrapped in an outer `data` envelope. */
export const unwrapData = <T>(res: unknown): T => {
  if (res && typeof res === 'object' && 'data' in res) {
    const inner = (res as { data?: unknown }).data
    if (inner && typeof inner === 'object') return inner as T
  }
  return res as T
}
