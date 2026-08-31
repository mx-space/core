import { Effect } from 'effect'

import { Generic } from '../../domain/errors'
import type { ApiService } from '../../services/Api'

const DRAFT_CORE_KEYS = new Set([
  'title',
  'text',
  'content',
  'contentFormat',
  'images',
  'meta',
])

export type DraftRefType = 'post' | 'note' | 'page'

export const REF_TYPE_TO_RESOURCE: Record<DraftRefType, string> = {
  post: 'posts',
  note: 'notes',
  page: 'pages',
}

export interface RevisionSnapshot {
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  text: string
  title: string
  typeSpecificData: Record<string, unknown> | null
}

export interface ContentRevision extends RevisionSnapshot {
  id: string
}

export interface ContentDocument {
  id: string
  publishedRevisionId: string | null
  refId: string | null
  refType: DraftRefType
}

export interface DraftRow {
  document: ContentDocument
  headRevision: ContentRevision
  headRevisionId: string
  id: string
  relationToPublished: 'same' | 'ancestor' | 'descendant' | 'diverged' | null
  status: 'active' | 'archived'
}

export interface VersionContext {
  branches: DraftRow[]
  document: ContentDocument
  publishedRevision: ContentRevision | null
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

/** The server serializes response keys to snake_case; normalize back. */
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

/** Single-object responses may arrive wrapped in an outer `data` envelope. */
export const unwrapData = <T>(res: unknown): T => {
  if (res && typeof res === 'object' && 'data' in res) {
    const inner = (res as { data?: unknown }).data
    if (inner && typeof inner === 'object') return inner as T
  }
  return res as T
}

export const normalizeData = <T>(value: unknown): T =>
  camelizeDeep(unwrapData(value)) as T

export const normalizeDraftRow = (row: unknown): DraftRow | null => {
  const normalized = normalizeData(row)
  if (!normalized || typeof normalized !== 'object') return null
  const branch = normalized as Partial<DraftRow>
  return branch.id && branch.document && branch.headRevision
    ? (branch as DraftRow)
    : null
}

export const normalizeVersionContext = (value: unknown): VersionContext =>
  normalizeData(value)

const mergeRevisionPatch = (
  base: RevisionSnapshot,
  patch: Record<string, unknown>,
): RevisionSnapshot => ({
  ...base,
  ...patch,
  typeSpecificData: {
    ...base.typeSpecificData,
    ...(patch.typeSpecificData as Record<string, unknown> | undefined),
  },
})

export const saveDraftPayload = (
  api: ApiService,
  refType: DraftRefType,
  payload: Record<string, unknown>,
  refId?: string,
) =>
  Effect.gen(function* () {
    const patch = splitDraftBody(payload)
    if (!refId) {
      const response = yield* api.request('/drafts', {
        method: 'POST',
        body: { data: patch, refType },
      })
      return { draft: normalizeDraftRow(response)!, response }
    }

    const context = normalizeVersionContext(
      yield* api.request(
        `/drafts/context/${refType}/${encodeURIComponent(refId)}`,
      ),
    )
    if (!context.publishedRevision) {
      return yield* Effect.fail(
        new Generic({
          message: `published revision not found for ${refType} ${refId}`,
        }),
      )
    }
    const response = yield* api.request('/drafts', {
      method: 'POST',
      body: {
        baseRevisionId: context.publishedRevision.id,
        data: mergeRevisionPatch(context.publishedRevision, patch),
        refId,
        refType,
      },
    })
    return { draft: normalizeDraftRow(response)!, response }
  })

export const publishSavedDraft = (api: ApiService, draft: DraftRow) =>
  api.request('/publish-jobs', {
    method: 'POST',
    body: {
      aiResources: [],
      branchId: draft.id,
      confirmDiverged:
        draft.relationToPublished === 'descendant' ||
        draft.relationToPublished === 'diverged',
      expectedPublishedRevisionId: draft.document.publishedRevisionId,
      revisionId: draft.headRevisionId,
    },
  })
