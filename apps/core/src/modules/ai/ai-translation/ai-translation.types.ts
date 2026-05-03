import type { CollectionRefTypes } from '~/constants/db.constant'

import type { NoteModel } from '../../note/note.types'
import type { PageModel } from '../../page/page.types'
import type { PostModel } from '../../post/post.types'

export interface ArticleContent {
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  contentFormat?: string | null
  content?: string | null
}

export type ArticleDocument = PostModel | NoteModel | PageModel

export type ArticleEventDocument = ArticleDocument

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
