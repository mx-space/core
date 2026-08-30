export type ArticleBodyKind = 'note' | 'post'

export type ArticleBodyLine =
  | {
      kind: ArticleBodyKind
      id: string
      missing: true
    }
  | {
      kind: 'note'
      hasPassword: true
      id: string
    }
  | {
      kind: ArticleBodyKind
      id: string
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
