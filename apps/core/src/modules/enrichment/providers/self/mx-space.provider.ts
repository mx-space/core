import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { isDev } from '~/global/env.global'
import { DEFAULT_SUMMARY_LANG } from '~/modules/ai/ai.constants'
import { AiSummaryService } from '~/modules/ai/ai-summary/ai-summary.service'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

const POST_PATH_RE = /^\/posts\/([^/]+)\/([^/]+)$/
const NOTE_DATE_PATH_RE = /^\/notes\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/([^/]+)$/
const NOTE_NID_PATH_RE = /^\/notes\/(\d+)$/

interface SelfLabels {
  type: string
  post: string
  note: string
  noteHash: string
}

const LABELS: Record<string, SelfLabels> = {
  zh: { type: '类型', post: '文章', note: '笔记', noteHash: '笔记 #' },
  ja: { type: '種類', post: '記事', note: 'ノート', noteHash: 'ノート #' },
  ko: { type: '종류', post: '글', note: '노트', noteHash: '노트 #' },
  en: { type: 'Type', post: 'Post', note: 'Note', noteHash: 'Note #' },
}

const pickLabels = (locale?: string): SelfLabels =>
  (locale && LABELS[locale]) || LABELS.en

@Injectable()
export class MxSpaceProvider implements EnrichmentProvider, OnModuleInit {
  readonly name = 'mx-space'
  readonly displayName = 'Mix Space'
  readonly category = ENRICHMENT_CATEGORIES.SELF
  readonly priority = 5
  /**
   * Self content lives in our own DB and changes whenever the author edits a
   * post or note. A long TTL would surface stale titles/descriptions in link
   * cards across the site; setting `0` makes every read mark the row expired
   * so the SWR layer enqueues a background refresh after returning the
   * cached value. Cost is one cheap local DB read plus a deduped task per
   * stale access — well worth the freshness for own content.
   */
  readonly defaultTtl = 0
  readonly localeAware = true
  readonly supportedLocales = ['zh', 'ja', 'ko', 'en'] as const

  private readonly logger = new Logger(MxSpaceProvider.name)
  /**
   * Cached configured site hostname (e.g. `innei.in`). `matchUrl` is
   * synchronous, but `configsService.get` is async — refresh into this slot
   * on init and on `ConfigChanged` so the path-matching pass can read it
   * without awaiting.
   */
  private siteHost: string | null = null

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configsService: ConfigsService,
    @Inject(forwardRef(() => AiSummaryService))
    private readonly aiSummaryService: AiSummaryService,
    @Inject(forwardRef(() => AiTranslationService))
    private readonly aiTranslationService: AiTranslationService,
  ) {}

  async onModuleInit() {
    await this.refreshSiteHost()
  }

  @OnEvent(EventBusEvents.ConfigChanged)
  async onConfigChanged() {
    await this.refreshSiteHost()
  }

  private async refreshSiteHost() {
    try {
      const url = await this.configsService.get('url')
      const webUrl = url?.webUrl
      this.siteHost = webUrl ? new URL(webUrl).hostname : null
    } catch (err) {
      this.logger.warn(
        `Failed to read configured webUrl for self provider host check: ${
          (err as Error)?.message ?? err
        }`,
      )
      this.siteHost = null
    }
  }

  matchUrl(url: URL): UrlMatchResult | null {
    // In production we only treat URLs whose hostname matches the configured
    // `webUrl` as self content — otherwise any third-party `/posts/cat/slug`
    // path would erroneously route here. In development the local backend's
    // `webUrl` is `localhost:2333`, but we want to verify the link card with
    // production URLs (`innei.in/...`), so skip the host check entirely.
    if (!isDev && (!this.siteHost || url.hostname !== this.siteHost))
      return null

    const path = url.pathname

    const postMatch = POST_PATH_RE.exec(path)
    if (postMatch) {
      const [, category, slug] = postMatch
      return {
        id: `post:${category}/${slug}`,
        fullUrl: url.href,
        subtype: 'post',
      }
    }

    const noteDateMatch = NOTE_DATE_PATH_RE.exec(path)
    if (noteDateMatch) {
      const [, year, month, day, slug] = noteDateMatch
      return {
        id: `note-date:${year}/${month}/${day}/${slug}`,
        fullUrl: url.href,
        subtype: 'note',
      }
    }

    const noteNidMatch = NOTE_NID_PATH_RE.exec(path)
    if (noteNidMatch) {
      return {
        id: `note:${noteNidMatch[1]}`,
        fullUrl: url.href,
        subtype: 'note',
      }
    }

    return null
  }

  isValidId(id: string): boolean {
    return /^(?:post|note|note-date):/.test(id)
  }

  async fetch(id: string, locale?: string): Promise<EnrichmentResult> {
    const labels = pickLabels(locale)
    const sepIdx = id.indexOf(':')
    const type = id.slice(0, sepIdx)
    const rest = id.slice(sepIdx + 1)

    if (type === 'post') {
      const slugIdx = rest.indexOf('/')
      const category = slugIdx === -1 ? '' : rest.slice(0, slugIdx)
      const slug = slugIdx === -1 ? rest : rest.slice(slugIdx + 1)
      const post = await this.databaseService.findPostBySlug(slug)
      if (!post) throw new Error(`Post not found: ${rest}`)
      const [translatedTitle, aiSummary] = await Promise.all([
        this.lookupTitle(post.id, locale),
        this.lookupSummary(post.id, locale),
      ])
      const description =
        aiSummary || post.summary || (post.text || '').slice(0, 300) || ''
      return {
        title: translatedTitle || post.title || rest,
        description: description || undefined,
        url: `/posts/${category}/${slug}`,
        category: this.category,
        subtype: 'post',
        fetchedAt: '',
        attributes: [
          {
            key: 'type',
            value: labels.post,
            label: labels.type,
            format: 'text',
          },
        ],
      }
    }

    if (type === 'note') {
      const nid = Number.parseInt(rest, 10)
      if (!Number.isFinite(nid)) throw new Error(`Invalid note nid: ${rest}`)
      const note = await this.databaseService.findNoteByNid(nid)
      if (!note) throw new Error(`Note not found: ${nid}`)
      const [translatedTitle, aiSummary] = await Promise.all([
        this.lookupTitle(note.id, locale),
        this.lookupSummary(note.id, locale),
      ])
      const description = aiSummary || (note.text || '').slice(0, 300) || ''
      return {
        title:
          translatedTitle ||
          note.title ||
          `${labels.noteHash}${note.nid || nid}`,
        description: description || undefined,
        url: `/notes/${note.nid || nid}`,
        category: this.category,
        subtype: 'note',
        fetchedAt: '',
        attributes: [
          {
            key: 'type',
            value: labels.note,
            label: labels.type,
            format: 'text',
          },
        ],
      }
    }

    if (type === 'note-date') {
      const [year, month, day, slug] = rest.split('/')
      const note = await this.databaseService.findNoteByDateAndSlug(
        Number(year),
        Number(month),
        Number(day),
        slug,
      )
      if (!note) throw new Error(`Note not found: ${rest}`)
      const [translatedTitle, aiSummary] = await Promise.all([
        this.lookupTitle(note.id, locale),
        this.lookupSummary(note.id, locale),
      ])
      const description = aiSummary || (note.text || '').slice(0, 300) || ''
      return {
        title: translatedTitle || note.title || `${labels.note} ${rest}`,
        description: description || undefined,
        url: `/notes/${year}/${month}/${day}/${slug}`,
        category: this.category,
        subtype: 'note',
        fetchedAt: '',
        attributes: [
          {
            key: 'type',
            value: labels.note,
            label: labels.type,
            format: 'text',
          },
        ],
      }
    }

    throw new Error(`Unknown self content type: ${type}`)
  }

  /**
   * Best-effort AI summary lookup keyed by article ref id. Falls back to
   * `null` when AI summary is disabled, never generated, or any lookup error
   * — the caller then reverts to the manual `summary` / `text` slice. Uses
   * the cheap `batchGetSummariesByRefIds` path so we never trigger an OpenAI
   * round-trip from a link-card render.
   */
  private async lookupSummary(
    refId: string,
    locale?: string,
  ): Promise<string | null> {
    try {
      const lang = locale || DEFAULT_SUMMARY_LANG
      const map = await this.aiSummaryService.batchGetSummariesByRefIds(
        [refId],
        lang,
      )
      return map.get(refId) ?? null
    } catch (err) {
      this.logger.debug(
        `AI summary lookup failed for ${refId}: ${(err as Error)?.message ?? err}`,
      )
      return null
    }
  }

  /**
   * Best-effort cached translated-title lookup. Without this, a `/ja/` page
   * pulling a self link card whose source post is in zh would render the
   * Chinese title even though the rest of the article reads in Japanese.
   * Returns `null` when no locale was negotiated, no translation exists in
   * that locale, or the lookup throws — the caller then keeps the original
   * `title`.
   */
  private async lookupTitle(
    refId: string,
    locale?: string,
  ): Promise<string | null> {
    if (!locale) return null
    try {
      const map = await this.aiTranslationService.findCachedTitlesByRefIds(
        [refId],
        locale,
      )
      return map.get(refId) ?? null
    } catch (err) {
      this.logger.debug(
        `AI translation title lookup failed for ${refId}: ${(err as Error)?.message ?? err}`,
      )
      return null
    }
  }
}
