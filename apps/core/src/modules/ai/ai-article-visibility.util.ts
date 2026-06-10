import { CollectionRefTypes } from '~/constants/db.constant'
import { isNoteSecret } from '~/utils/biz.util'

import type { NoteModel } from '../note/note.types'
import type { PostModel } from '../post/post.types'

type VisibilityArticle = { type: CollectionRefTypes; document: unknown }

/**
 * Whether an article is publicly visible (published, not password-protected,
 * not a future-dated note secret). Pages are always visible. Recently entries
 * are never treated as visible articles.
 *
 * Shared by every AI feature (summary, insights, translation) so public
 * endpoints never leak draft or protected content.
 */
export function isGlobalArticleVisible(article: VisibilityArticle): boolean {
  if (article.type === CollectionRefTypes.Post) {
    return (article.document as PostModel).isPublished !== false
  }

  if (article.type === CollectionRefTypes.Note) {
    const document = article.document as NoteModel
    if (document.isPublished === false) return false
    if (document.password) return false
    if (isNoteSecret(document)) return false
    return true
  }

  if (article.type === CollectionRefTypes.Page) {
    return true
  }

  return false
}
