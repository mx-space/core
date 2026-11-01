export type PublishedUsageType =
  'post' | 'note' | 'page' | 'translation' | 'share'

export type OtherUsageType = 'snippet' | 'topic' | 'recently'

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
  bytes: number | null
  drafts: DraftUsage[]
  fileReferenceId: string | null
  historyOnly: boolean
  other: OtherUsage[]
  published: PublishedUsage[]
  url: string
}
