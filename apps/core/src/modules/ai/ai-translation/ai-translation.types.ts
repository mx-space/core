import type { CollectionRefTypes } from '~/constants/db.constant'
import type { EntityId } from '~/shared/id/entity-id'

import type { NoteModel } from '../../note/note.types'
import type { PageModel } from '../../page/page.types'
import type { PostModel } from '../../post/post.types'
import type { TranslationEntryKeyPath } from './translation-entry.types'

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

export interface AiTranslationRow {
  id: EntityId
  hash: string
  refId: EntityId
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  subtitle: string | null
  summary: string | null
  tags: string[]
  sourceModifiedAt: Date | null
  aiModel: string | null
  aiProvider: string | null
  contentFormat: string | null
  content: string | null
  sourceBlockSnapshots: unknown
  sourceMetaHashes: unknown
  createdAt: Date
}

export interface TranslationEntryRow {
  id: EntityId
  keyPath: TranslationEntryKeyPath
  lang: string
  keyType: string
  lookupKey: string
  sourceText: string
  translatedText: string
  sourceUpdatedAt: Date | null
  createdAt: Date
}
