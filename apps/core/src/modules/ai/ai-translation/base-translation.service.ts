import dayjs from 'dayjs'

import { CollectionRefTypes } from '~/constants/db.constant'
import { computeContentHash as computeContentHashUtil } from '~/utils/content.util'

import type { NoteModel } from '../../note/note.model'
import type { PageModel } from '../../page/page.model'
import type { PostModel } from '../../post/post.model'
import type {
  ArticleContent,
  ArticleDocument,
  GlobalArticle,
} from './ai-translation.types'

export abstract class BaseTranslationService {
  toArticleContent(document: ArticleDocument): ArticleContent {
    return {
      title: document.title,
      text: document.text,
      summary:
        'summary' in document ? (document.summary ?? undefined) : undefined,
      tags: 'tags' in document ? document.tags : undefined,
      contentFormat: document.contentFormat,
      content: document.content,
    }
  }

  getMetaLang(document: { meta?: { lang?: string } }): string | undefined {
    return document.meta?.lang
  }

  computeContentHash(document: ArticleContent, sourceLang: string): string {
    return computeContentHashUtil(
      {
        title: document.title,
        text: document.text,
        contentFormat: document.contentFormat,
        content: document.content,
        summary: document.summary,
        tags: document.tags,
      },
      sourceLang,
    )
  }

  isPostArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Post; document: PostModel } {
    return article.type === CollectionRefTypes.Post
  }

  isNoteArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Note; document: NoteModel } {
    return article.type === CollectionRefTypes.Note
  }

  isPageArticle(
    article: GlobalArticle,
  ): article is { type: CollectionRefTypes.Page; document: PageModel } {
    return article.type === CollectionRefTypes.Page
  }

  isArticleVisible(article: GlobalArticle): boolean {
    if (this.isPostArticle(article)) {
      return article.document.isPublished !== false
    }

    if (this.isNoteArticle(article)) {
      const document = article.document
      if (document.isPublished === false) return false
      if (document.password) return false
      if (document.publicAt && dayjs(document.publicAt).isAfter(new Date())) {
        return false
      }
      return true
    }

    if (this.isPageArticle(article)) {
      return true
    }

    return false
  }
}
