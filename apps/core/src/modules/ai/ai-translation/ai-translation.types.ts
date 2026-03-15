import type { CollectionRefTypes } from '~/constants/db.constant'

import type { NoteModel } from '../../note/note.model'
import type { PageModel } from '../../page/page.model'
import type { PostModel } from '../../post/post.model'

export interface ArticleContent {
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  contentFormat?: string
  content?: string
}

export type ArticleDocument = PostModel | NoteModel | PageModel

export type ArticleEventDocument = ArticleDocument & {
  _id?: { toString?: () => string } | string
}

export type ArticleEventPayload =
  | ArticleEventDocument
  | { data: string }
  | { id: string }

export type GlobalArticle =
  | { document: PostModel; type: CollectionRefTypes.Post }
  | { document: NoteModel; type: CollectionRefTypes.Note }
  | { document: PageModel; type: CollectionRefTypes.Page }
  | {
      document: unknown
      type: CollectionRefTypes.Recently
    }
