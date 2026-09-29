import { postJson } from './http'
import type { AITask } from './tasks'

export type PublishAiResource = 'insights' | 'summary' | 'translation' | 'tts'
export type PublishAiMode = 'sync' | 'async'

export interface PublishAiResourceRequest {
  mode: PublishAiMode
  resource: PublishAiResource
}

export interface PublishTaskPayload {
  aiResources: Array<PublishAiResource | PublishAiResourceRequest>
  branchId: string
  documentId: string
  operation: 'first-publish' | 'online-update' | 'republish'
  refId: null | string
  refType: 'note' | 'page' | 'post'
  revisionId: string
  snapshot: { title: string }
}

export interface PublishTaskResult {
  articleCommitted: boolean
  articleId: string
  newerDraftChanges: boolean
  publishedRevisionId: string
  resources: Partial<Record<PublishAiResource, string>>
}

export type PublishTask = Omit<AITask, 'payload' | 'result' | 'type'> & {
  payload: PublishTaskPayload
  result?: PublishTaskResult
  type: 'content:publish'
}

export function createPublishJob(input: {
  aiResources: PublishAiResourceRequest[]
  branchId: string
  confirmDiverged: boolean
  expectedPublishedRevisionId: string | null
  revisionId: string
}) {
  return postJson<{ created: boolean; taskId: string }, typeof input>(
    '/publish-jobs',
    input,
  )
}
