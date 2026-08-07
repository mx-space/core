import { CollectionRefTypes } from '~/constants/db.constant'
import { isNoteSecret } from '~/utils/biz.util'

import type { NoteModel } from '../note/note.types'
import type { PostModel } from '../post/post.types'

type VisibilityArticle = { type: CollectionRefTypes; document: unknown }

export interface ArticleViewer {
  /** The authenticated site owner — sees drafts, secrets and protected notes. */
  isOwner?: boolean
  /** The reader supplied the note's password and it verified. */
  hasNotePassword?: boolean
}

// `NoteRepository.mapBase` projects the column to `hasPassword` and drops the
// secret itself, so a document loaded through `findGlobalById` never carries
// `password` — checking that field alone silently admits protected notes.
function noteIsPasswordProtected(
  document: NoteModel & { hasPassword?: boolean },
): boolean {
  return Boolean(document.password) || Boolean(document.hasPassword)
}

/**
 * Whether an article is visible to the given viewer (published, not
 * password-protected, not a future-dated note secret). Pages are always
 * visible. Recently entries are never treated as visible articles.
 *
 * Shared by every AI feature (summary, insights, translation, tts) so public
 * endpoints never leak draft or protected content.
 */
export function isArticleVisibleToViewer(
  article: VisibilityArticle,
  viewer: ArticleViewer,
): boolean {
  if (article.type === CollectionRefTypes.Post) {
    if (viewer.isOwner) return true
    return (article.document as PostModel).isPublished !== false
  }

  if (article.type === CollectionRefTypes.Note) {
    const document = article.document as NoteModel & { hasPassword?: boolean }
    if (viewer.isOwner) return true
    if (document.isPublished === false) return false
    if (noteIsPasswordProtected(document) && !viewer.hasNotePassword) {
      return false
    }
    if (isNoteSecret(document)) return false
    return true
  }

  if (article.type === CollectionRefTypes.Page) {
    return true
  }

  return false
}

export function isGlobalArticleVisible(article: VisibilityArticle): boolean {
  return isArticleVisibleToViewer(article, {})
}
