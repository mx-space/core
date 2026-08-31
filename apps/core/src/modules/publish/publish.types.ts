import type { MarkdownToLexicalMigrationDescriptor } from '../content-migration/content-migration.schema'
import type { DraftRefType } from '../draft/draft.enum'
import type { RevisionSnapshot } from '../draft/draft.types'

export const CONTENT_PUBLISH_TASK = 'content:publish'

export type PublishAiResource = 'insights' | 'summary' | 'translation' | 'tts'
export type PublishOperation = 'first-publish' | 'online-update' | 'republish'

export type PublishSnapshot = RevisionSnapshot

export interface PublishTaskPayload {
  aiResources: PublishAiResource[]
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
