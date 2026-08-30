export type ArticleBodyKind = 'note' | 'post'

export interface ArticleBodyRequestItem {
  bodyVersion?: number
  id: string
  kind: ArticleBodyKind
}

export const ARTICLE_BODY_BATCH_LIMIT = 20

export type ArticleBodyLine =
  | {
      id: string
      kind: ArticleBodyKind
      missing: true
    }
  | {
      hasPassword: true
      id: string
      kind: 'note'
    }
  | {
      id: string
      kind: ArticleBodyKind
      unchanged: true
    }
  | {
      content: string | null
      contentFormat: string
      createdAt: string
      id: string
      isPremium?: boolean
      kind: ArticleBodyKind
      locked?: boolean
      modifiedAt: string | null
      text: string
    }
