import { Injectable } from '@nestjs/common'
import { Observable } from 'rxjs'

import { EntitlementService } from '~/modules/membership/entitlement.service'
import { NoteService } from '~/modules/note/note.service'
import type { NoteRow } from '~/modules/note/note.types'
import { PostService } from '~/modules/post/post.service'
import type { PostRow } from '~/modules/post/post.types'
import {
  applyArticleTranslationInPlace,
  type ArticleTranslationInput,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import {
  getPublicContent,
  getPublicText,
} from '~/processors/helper/lexical-truncate.util'

import type { ArticleBodyItem } from './article-body.schema'
import type { ArticleBodyLine } from './article-body.types'

type StreamContext = {
  isOwner: boolean
  lang?: string
  readerId?: string
}

type BodyDoc = {
  content: string | null
  contentFormat: string
  createdAt: Date
  id: string
  isPremium?: boolean
  kind: 'note' | 'post'
  meta?: { lang?: string; paywall?: { previewBlocks?: number } } | null
  modifiedAt: Date | null
  text: string
  title: string
}

function contentVersion(doc: { createdAt: Date; modifiedAt: Date | null }) {
  const created = doc.createdAt.getTime()
  const modified = doc.modifiedAt ? doc.modifiedAt.getTime() : 0
  return Math.max(created, modified)
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null
}

function isNotePubliclyListed(note: NoteRow) {
  if (!note.isPublished) return false
  if (note.publicAt && note.publicAt.getTime() > Date.now()) return false
  return true
}

function applyPaywallTeaser(doc: BodyDoc): BodyDoc {
  const source = { ...doc, isPremium: true }
  return {
    ...doc,
    content: getPublicContent(source),
    text: getPublicText(source),
  }
}

function toTranslationInput(doc: BodyDoc): ArticleTranslationInput {
  return {
    id: doc.id,
    title: doc.title,
    text: doc.text,
    meta: doc.meta ?? undefined,
    contentFormat: doc.contentFormat,
    content: doc.content,
    modifiedAt: doc.modifiedAt,
    createdAt: doc.createdAt,
  }
}

function toBodyLine(
  doc: BodyDoc,
  extra: { locked?: boolean } = {},
): ArticleBodyLine {
  return {
    content: doc.content,
    contentFormat: doc.contentFormat,
    createdAt: doc.createdAt.toISOString(),
    id: doc.id,
    kind: doc.kind,
    modifiedAt: toIso(doc.modifiedAt),
    text: doc.text,
    ...(doc.isPremium ? { isPremium: true } : {}),
    ...(extra.locked !== undefined ? { locked: extra.locked } : {}),
  }
}

@Injectable()
export class ArticleBodyService {
  constructor(
    private readonly postService: PostService,
    private readonly noteService: NoteService,
    private readonly translationService: TranslationService,
    private readonly entitlementService: EntitlementService,
  ) {}

  streamBodies(
    items: ArticleBodyItem[],
    context: StreamContext,
  ): Observable<ArticleBodyLine> {
    return new Observable((subscriber) => {
      let cancelled = false

      const emit = (line: ArticleBodyLine) => {
        if (cancelled || subscriber.closed) return
        subscriber.next(line)
      }

      const run = async () => {
        const pending = await this.resolveItems(items, context)
        for (const entry of pending) {
          if ('line' in entry) emit(entry.line)
        }
        if (cancelled || subscriber.closed) return

        const toTranslate = pending.flatMap((entry) =>
          'doc' in entry ? [entry.doc] : [],
        )
        if (toTranslate.length > 0 && context.lang) {
          const { results } =
            await this.translationService.collectArticleTranslations({
              articles: toTranslate.map(toTranslationInput),
              targetLang: context.lang,
              fields: ['title', 'text', 'content', 'contentFormat'],
            })
          if (cancelled || subscriber.closed) return
          for (const entry of pending) {
            if (!('doc' in entry)) continue
            const translation = results.get(entry.doc.id)
            if (translation?.isTranslated) {
              applyArticleTranslationInPlace(entry.doc, translation as any, {
                fields: ['title', 'text', 'content', 'contentFormat'],
              })
            }
          }
        }

        const lockPremium =
          toTranslate.some((doc) => doc.isPremium) &&
          (await this.entitlementService.isPremiumLocked({
            isPremium: true,
            isOwner: context.isOwner,
            readerId: context.readerId,
          }))
        if (cancelled || subscriber.closed) return

        for (const entry of pending) {
          if (!('doc' in entry)) continue
          if (entry.doc.isPremium && lockPremium) {
            emit(toBodyLine(applyPaywallTeaser(entry.doc), { locked: true }))
            continue
          }
          emit(
            toBodyLine(entry.doc, entry.doc.isPremium ? { locked: false } : {}),
          )
        }
        if (!cancelled && !subscriber.closed) subscriber.complete()
      }

      void run().catch((error) => {
        if (!cancelled && !subscriber.closed) subscriber.error(error)
      })

      return () => {
        cancelled = true
      }
    })
  }

  private async resolveItems(
    items: ArticleBodyItem[],
    context: StreamContext,
  ): Promise<
    Array<
      | { item: ArticleBodyItem; line: ArticleBodyLine }
      | { item: ArticleBodyItem; doc: BodyDoc }
    >
  > {
    const postIds = [
      ...new Set(
        items.filter((item) => item.kind === 'post').map((item) => item.id),
      ),
    ]
    const noteIds = [
      ...new Set(
        items.filter((item) => item.kind === 'note').map((item) => item.id),
      ),
    ]

    const [posts, notes] = await Promise.all([
      this.postService.findManyByIds(postIds),
      this.noteService.findManyByIds(noteIds),
    ])
    const postsById = new Map(posts.map((post) => [String(post.id), post]))
    const notesById = new Map(notes.map((note) => [String(note.id), note]))

    const resolved: Array<
      | { item: ArticleBodyItem; line: ArticleBodyLine }
      | { item: ArticleBodyItem; doc: BodyDoc }
    > = []

    for (const item of items) {
      if (item.kind === 'post') {
        const post = postsById.get(item.id)
        if (!post || (!context.isOwner && !post.isPublished)) {
          resolved.push({
            item,
            line: { id: item.id, kind: 'post', missing: true },
          })
          continue
        }
        const doc = this.fromPost(post)
        if (
          item.bodyVersion !== undefined &&
          item.bodyVersion >= contentVersion(doc)
        ) {
          resolved.push({
            item,
            line: { id: item.id, kind: 'post', unchanged: true },
          })
          continue
        }
        resolved.push({ item, doc })
        continue
      }

      const note = notesById.get(item.id)
      if (!note || (!context.isOwner && !isNotePubliclyListed(note))) {
        resolved.push({
          item,
          line: { id: item.id, kind: 'note', missing: true },
        })
        continue
      }
      if (!context.isOwner && note.hasPassword) {
        resolved.push({
          item,
          line: { hasPassword: true, id: item.id, kind: 'note' },
        })
        continue
      }
      const doc = this.fromNote(note)
      if (
        item.bodyVersion !== undefined &&
        item.bodyVersion >= contentVersion(doc)
      ) {
        resolved.push({
          item,
          line: { id: item.id, kind: 'note', unchanged: true },
        })
        continue
      }
      resolved.push({ item, doc })
    }

    return resolved
  }

  private fromPost(post: PostRow): BodyDoc {
    return {
      content: post.content,
      contentFormat: post.contentFormat,
      createdAt: post.createdAt,
      id: String(post.id),
      isPremium: post.isPremium,
      kind: 'post',
      meta: post.meta as BodyDoc['meta'],
      modifiedAt: post.modifiedAt,
      text: post.text,
      title: post.title,
    }
  }

  private fromNote(note: NoteRow): BodyDoc {
    return {
      content: note.content,
      contentFormat: note.contentFormat,
      createdAt: note.createdAt,
      id: String(note.id),
      kind: 'note',
      meta: note.meta as BodyDoc['meta'],
      modifiedAt: note.modifiedAt,
      text: note.text,
      title: note.title,
    }
  }
}
