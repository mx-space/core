import type { MarkdownToLexicalMigrationDescriptor } from '../content-migration/content-migration.schema'
import type { DraftRefType } from '../draft/draft.enum'
import type { RevisionSnapshot } from '../draft/draft.types'

export const CONTENT_PUBLISH_TASK = 'content:publish'

export type PublishAiResource = 'insights' | 'summary' | 'translation' | 'tts'
export type PublishAiMode = 'sync' | 'async'

export interface PublishAiResourceRequest {
  mode: PublishAiMode
  resource: PublishAiResource
}
export type PublishOperation = 'first-publish' | 'online-update' | 'republish'

export type PublishSnapshot = RevisionSnapshot

export interface PublishTaskPayload {
  aiResources: PublishAiResourceRequest[]
  branchId: string
  documentId: string
  expectedPublishedRevisionId: string | null
  migration?: MarkdownToLexicalMigrationDescriptor
  operation: PublishOperation
  refId: string | null
  refType: DraftRefType
  revisionId: string
  snapshot: PublishSnapshot
}

export interface PublishTaskResult {
  articleCommitted: boolean
  articleId: string
  newerDraftChanges: boolean
  publishedRevisionId: string
  resources: Partial<Record<PublishAiResource, string>>
}

export function normalizePublishAiResources(
  resources: ReadonlyArray<PublishAiResource | PublishAiResourceRequest>,
): PublishAiResourceRequest[] {
  const seen = new Set<PublishAiResource>()
  const normalized: PublishAiResourceRequest[] = []
  for (const item of resources) {
    const request =
      typeof item === 'string'
        ? { mode: 'sync' as const, resource: item }
        : item
    if (seen.has(request.resource)) continue
    seen.add(request.resource)
    normalized.push({ mode: request.mode, resource: request.resource })
  }
  return normalized
}
