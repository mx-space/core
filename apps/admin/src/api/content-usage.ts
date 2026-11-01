import { postJson } from './http'

export type PublishedUsageType =
  'note' | 'page' | 'post' | 'share' | 'translation'

export type OtherUsageType = 'recently' | 'snippet' | 'topic'

export interface PublishedUsage {
  id: string
  slug?: string
  title: string
  type: PublishedUsageType
}

export interface DraftUsage {
  documentId: string
  draftId: string
  live: boolean
  title: string
}

export interface OtherUsage {
  id: string
  title: string
  type: OtherUsageType
}

export interface ContentUsage {
  bytes: null | number
  drafts: DraftUsage[]
  fileReferenceId: null | string
  historyOnly: boolean
  other: OtherUsage[]
  published: PublishedUsage[]
  url: string
}

const USAGE_BATCH_SIZE = 500

export async function getContentUsage(urls: string[]): Promise<ContentUsage[]> {
  const unique = [...new Set(urls.filter(Boolean))]
  const batches: string[][] = []
  for (let i = 0; i < unique.length; i += USAGE_BATCH_SIZE)
    batches.push(unique.slice(i, i + USAGE_BATCH_SIZE))
  const results = await Promise.all(
    batches.map((batch) =>
      postJson<ContentUsage[], { urls: string[] }>('/files/references/usage', {
        urls: batch,
      }),
    ),
  )
  return results.flat()
}
