import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { RequestContext } from '~/common/contexts/request.context'
import { BusinessEvents } from '~/constants/business-event.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import type { AiTranslationRow } from '~/modules/ai/ai-translation/ai-translation.types'
import type { SearchDto } from '~/modules/search/search.schema'
import type { PaginationResult } from '~/processors/database/base.repository'
import { paginationOf } from '~/processors/database/base.repository'
import {
  getPublicContent,
  getPublicText,
} from '~/processors/helper/lexical-truncate.util'
import { AsyncQueue } from '~/utils/queue.util'

import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import type { PostService } from '../post/post.service'
import {
  SEARCH_BM25_B,
  SEARCH_BM25_BODY_WEIGHT,
  SEARCH_BM25_K1,
  SEARCH_BM25_TITLE_WEIGHT,
  SEARCH_CANDIDATE_MULTIPLIER,
  SEARCH_EXACT_TITLE_BONUS,
  SEARCH_FALLBACK_DISCOUNT,
  SEARCH_MAX_CANDIDATES,
  SEARCH_PREFIX_TITLE_BONUS,
} from './search.constants'
import { SearchRepository } from './search.repository'
import {
  SearchDocumentModel,
  type SearchDocumentRefType,
  type SearchDocumentRow,
} from './search-document.types'
import {
  buildSearchDocument,
  computeSourceHash,
  computeTranslationSourceHash,
  normalizeSearchText,
  SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG,
  tokenizeSearchText,
} from './search-document.util'

type SearchDocumentLean = SearchDocumentRow

type SearchCorpusStats = {
  totalDocs: number
  avgTitleLength: number
  avgBodyLength: number
}

type SearchHighlight = {
  keywords: string[]
  snippet: string | null
}

type RankedHit = SearchDocumentLean & {
  refType: SearchDocumentRefType
  __isFallback: boolean
  __searchWeight?: number
}

type RebuildOptions = { force?: boolean }

type RebuildStats = {
  total: number
  created: number
  updated: number
  deleted: number
  skipped: number
}

const SOURCE_LANG_CACHE_LIMIT = 200
const ARTICLE_PAGE_SIZE = 50
// pg pool max is 20 — keep headroom for concurrent requests
const REBUILD_WRITE_CONCURRENCY = 10

async function runAllOrThrow<T>(
  items: T[],
  task: (item: T) => Promise<unknown>,
) {
  const { errors } = await AsyncQueue.runAll(
    items,
    task,
    REBUILD_WRITE_CONCURRENCY,
  )
  if (errors.size > 0) {
    throw errors.values().next().value
  }
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  /**
   * LRU cache of refId -> sourceLang. Keeps the BM25 source-language
   * resolution cheap on update events.
   */
  private readonly sourceLangCache = new Map<string, string>()

  constructor(
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,

    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,

    private readonly searchRepository: SearchRepository,

    @Inject(forwardRef(() => AiTranslationRepository))
    private readonly aiTranslationRepository: AiTranslationRepository,
  ) {}

  private toPublicArticleFields<T extends Record<string, any>>(article: T): T {
    if (!article?.isPremium) return article
    return {
      ...article,
      text: getPublicText(article),
      content: getPublicContent(article),
    }
  }

  async search(searchOption: SearchDto) {
    return this.searchIndex(searchOption, undefined)
  }

  async searchNote(searchOption: SearchDto) {
    return this.searchIndex(searchOption, 'note')
  }

  async searchPost(searchOption: SearchDto) {
    return this.searchIndex(searchOption, 'post')
  }

  async searchPage(searchOption: SearchDto) {
    return this.searchIndex(searchOption, 'page')
  }

  // ─────────────────────────────────────────────────────── rebuild path ──

  async rebuildSearchDocuments(
    options: RebuildOptions = {},
  ): Promise<RebuildStats> {
    if (options.force) {
      return this.rebuildForce()
    }
    return this.rebuildIncremental()
  }

  private async rebuildForce(): Promise<RebuildStats> {
    const documents = await this.collectAllExpectedDocuments()
    await this.searchRepository.deleteAll()
    await runAllOrThrow(documents, (doc) =>
      this.searchRepository.upsert(doc as any),
    )
    const created = documents.length
    this.logger.log(
      `rebuilt search index (force), upserted ${created} documents`,
    )
    return {
      total: created,
      created,
      updated: 0,
      deleted: 0,
      skipped: 0,
    }
  }

  private async rebuildIncremental(): Promise<RebuildStats> {
    const expected = await this.collectAllExpectedDocuments()
    const existing = await this.searchRepository.findHashesByRefMap()

    const expectedKeys = new Set<string>()
    let created = 0
    let updated = 0
    let skipped = 0
    const toUpsert: typeof expected = []
    for (const doc of expected) {
      const key = `${doc.refType}:${doc.refId}:${doc.lang}`
      expectedKeys.add(key)
      const prevHash = existing.get(key)
      if (prevHash !== undefined && prevHash === doc.sourceHash) {
        skipped++
        continue
      }
      toUpsert.push(doc)
      if (prevHash === undefined) {
        created++
      } else {
        updated++
      }
    }
    await runAllOrThrow(toUpsert, (doc) =>
      this.searchRepository.upsert(doc as any),
    )

    let deleted = 0
    const toDelete: Array<[SearchDocumentRefType, string, string]> = []
    for (const key of existing.keys()) {
      if (expectedKeys.has(key)) continue
      const [refType, refId, lang] = key.split(':')
      if (!refType || !refId || lang === undefined) continue
      toDelete.push([refType as SearchDocumentRefType, refId, lang])
      deleted++
    }
    await runAllOrThrow(toDelete, ([refType, refId, lang]) =>
      this.searchRepository.deleteByRef(refType, refId, lang),
    )

    this.logger.log(
      `rebuilt search index (incremental): total=${expected.length} created=${created} updated=${updated} deleted=${deleted} skipped=${skipped}`,
    )
    return {
      total: expected.length,
      created,
      updated,
      deleted,
      skipped,
    }
  }

  /**
   * Walk every article (post/note/page) plus every translation row and
   * project them into the SearchDocument shape. Results are paginated to
   * avoid pulling tens of thousands of rows into memory at once.
   */
  private async collectAllExpectedDocuments() {
    const docs: Array<Omit<SearchDocumentModel, 'id'>> = []

    // Articles → source-language documents; the same fetch also feeds the
    // translation overlay below.
    const articleCache = new Map<
      string,
      { article: any; refType: SearchDocumentRefType }
    >()
    for (const refType of ['post', 'note', 'page'] as const) {
      const articles = await this.collectAllArticles(refType)
      const sourceLangs = await this.resolveSourceLangs(
        refType,
        articles.map((a) => a.id),
      )
      for (const article of articles) {
        const lang =
          sourceLangs.get(article.id) ?? SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG
        docs.push(
          buildSearchDocument(
            refType,
            this.toPublicArticleFields(article as any),
            lang,
          ),
        )
        articleCache.set(`${refType}:${article.id}`, { article, refType })
      }
    }

    // Translations → per-language documents (overlay article visibility)

    let page = 1

    while (true) {
      const { data, pagination } = await this.aiTranslationRepository.list(
        page,
        100,
      )
      for (const t of data) {
        const refType = t.refType as SearchDocumentRefType
        if (refType !== 'post' && refType !== 'note' && refType !== 'page') {
          continue
        }
        const article = articleCache.get(`${refType}:${t.refId}`)?.article
        if (!article) continue
        docs.push(this.buildTranslationSearchDocument(refType, article, t))
      }
      if (page >= pagination.totalPage) break
      page++
    }

    return docs
  }

  private async collectAllArticles(
    refType: SearchDocumentRefType,
  ): Promise<any[]> {
    if (refType === 'page') {
      return this.pageService.findAll() as any
    }

    const out: any[] = []
    let page = 1

    while (true) {
      const result =
        refType === 'post'
          ? await this.postService.list({ page, size: ARTICLE_PAGE_SIZE })
          : await this.noteService.listPaginated(page, ARTICLE_PAGE_SIZE)
      out.push(...result.data)
      if (page >= result.pagination.totalPage) break
      page++
    }
    return out
  }

  // ───────────────────────────────────────────────────── upsert / delete ──

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.POST_UPDATE)
  async onPostCreate(post: { id: string }) {
    this.sourceLangCache.delete(post.id)
    await this.upsertSearchDocument('post', post.id)
  }

  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async onNoteCreate(note: { id: string }) {
    this.sourceLangCache.delete(note.id)
    await this.upsertSearchDocument('note', note.id)
  }

  @OnEvent(BusinessEvents.PAGE_CREATE)
  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async onPageCreate(page: { id: string }) {
    this.sourceLangCache.delete(page.id)
    await this.upsertSearchDocument('page', page.id)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  async onPostDelete({ id }: { id: string }) {
    this.sourceLangCache.delete(id)
    await this.searchRepository.deleteByRef('post', id)
  }

  @OnEvent(BusinessEvents.NOTE_DELETE)
  async onNoteDelete({ id }: { id: string }) {
    this.sourceLangCache.delete(id)
    await this.searchRepository.deleteByRef('note', id)
  }

  @OnEvent(BusinessEvents.PAGE_DELETE)
  async onPageDelete({ id }: { id: string }) {
    this.sourceLangCache.delete(id)
    await this.searchRepository.deleteByRef('page', id)
  }

  @OnEvent(BusinessEvents.TRANSLATION_CREATE)
  @OnEvent(BusinessEvents.TRANSLATION_UPDATE)
  async onTranslationUpsert(payload: {
    refId: string
    refType: string
    lang: string
  }) {
    const refType = payload.refType as SearchDocumentRefType
    if (refType !== 'post' && refType !== 'note' && refType !== 'page') return
    const translation = await this.aiTranslationRepository.findByRef(
      payload.refId,
      payload.refType,
      payload.lang,
    )
    if (!translation) return
    await this.upsertTranslationSearchDocument(translation)
  }

  @OnEvent(BusinessEvents.TRANSLATION_DELETE)
  async onTranslationDelete(payload: {
    refId: string
    refType: string
    lang?: string
  }) {
    const refType = payload.refType as SearchDocumentRefType
    if (refType !== 'post' && refType !== 'note' && refType !== 'page') return
    await this.searchRepository.deleteByRef(
      refType,
      payload.refId,
      payload.lang,
    )
  }

  async adminListDocuments(query: {
    refType?: SearchDocumentRefType
    lang?: string
    keyword?: string
    page?: number
    size?: number
  }) {
    return this.searchRepository.findAdminRows(query)
  }

  async rebuildSingleRef(
    refType: SearchDocumentRefType,
    refId: string,
  ): Promise<{ rebuilt: number }> {
    const article = await this.loadSourceDocument(refType, refId)
    if (!article) {
      await this.searchRepository.deleteByRef(refType, refId)
      return { rebuilt: 0 }
    }

    let rebuilt = 0
    const sourceLang = await this.resolveSourceLang(refType, refId)
    await this.searchRepository.upsert(
      buildSearchDocument(
        refType,
        this.toPublicArticleFields(article as any),
        sourceLang,
      ) as any,
    )
    rebuilt++

    const translations = await this.aiTranslationRepository.listByRefId(refId)
    for (const t of translations) {
      if (t.refType !== refType) continue
      await this.searchRepository.upsert(
        this.buildTranslationSearchDocument(refType, article, t) as any,
      )
      rebuilt++
    }

    return { rebuilt }
  }

  private async upsertSearchDocument(
    refType: SearchDocumentRefType,
    id: string,
  ) {
    const sourceDocument = await this.loadSourceDocument(refType, id)
    if (!sourceDocument) {
      await this.searchRepository.deleteByRef(refType, id)
      return
    }

    const sourceLang = await this.resolveSourceLang(refType, id)
    await this.searchRepository.upsert(
      buildSearchDocument(
        refType,
        this.toPublicArticleFields(sourceDocument as any),
        sourceLang,
      ) as any,
    )
  }

  private async upsertTranslationSearchDocument(translation: AiTranslationRow) {
    const refType = translation.refType as SearchDocumentRefType
    if (refType !== 'post' && refType !== 'note' && refType !== 'page') return

    const article = await this.loadSourceDocument(refType, translation.refId)
    if (!article) {
      this.logger.warn(
        `translation upsert skipped: source article not found refType=${refType} refId=${translation.refId} lang=${translation.lang}`,
      )
      return
    }

    await this.searchRepository.upsert(
      this.buildTranslationSearchDocument(refType, article, translation) as any,
    )
  }

  /**
   * Build a translation-language search document. Visibility/structure fields
   * (slug, nid, isPublished, publicAt, hasPassword) come from the source
   * article so policy is consistent; content fields come from the translation
   * row.
   */
  private buildTranslationSearchDocument(
    refType: SearchDocumentRefType,
    article: Record<string, any>,
    translation: AiTranslationRow,
  ): Omit<SearchDocumentModel, 'id'> {
    const merged = {
      id: translation.refId,
      title: translation.title,
      text: translation.text,
      contentFormat: translation.contentFormat,
      content: translation.content,
      isPremium: article.isPremium,
      meta: article.meta,
      tags: translation.tags ?? [],
      slug: article.slug ?? null,
      nid: article.nid ?? null,
      isPublished: article.isPublished ?? true,
      publicAt: article.publicAt ?? null,
      password: article.password,
      hasPassword: article.hasPassword,
      createdAt: article.createdAt ?? new Date(),
      modifiedAt: article.modifiedAt ?? null,
      sourceHash: computeTranslationSourceHash(translation),
    }
    return buildSearchDocument(
      refType,
      this.toPublicArticleFields(merged),
      translation.lang,
    )
  }

  // ───────────────────────────────────────────────── source lang resolve ──

  private async resolveSourceLangs(
    _refType: SearchDocumentRefType,
    refIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (!refIds.length) return out
    const translations = await this.aiTranslationRepository.listByRefIds(refIds)
    for (const t of translations) {
      // any translation row carries the canonical sourceLang of the article.
      if (!out.has(t.refId)) out.set(t.refId, t.sourceLang)
    }
    return out
  }

  private async resolveSourceLang(
    refType: SearchDocumentRefType,
    refId: string,
  ): Promise<string> {
    const cached = this.sourceLangCache.get(refId)
    if (cached) {
      // Refresh LRU position
      this.sourceLangCache.delete(refId)
      this.sourceLangCache.set(refId, cached)
      return cached
    }

    const translations = await this.aiTranslationRepository.listByRefId(refId)
    let lang =
      translations.find((t) => t.refType === refType)?.sourceLang ??
      translations[0]?.sourceLang

    if (!lang) {
      const article = await this.loadSourceDocument(refType, refId)
      const articleMeta = (article as any)?.meta
      const metaLang = articleMeta?.lang
      if (typeof metaLang === 'string' && metaLang) {
        lang = metaLang
      }
    }

    if (!lang) lang = SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG

    this.cacheSourceLang(refId, lang)
    return lang
  }

  private cacheSourceLang(refId: string, lang: string) {
    if (this.sourceLangCache.has(refId)) {
      this.sourceLangCache.delete(refId)
    } else if (this.sourceLangCache.size >= SOURCE_LANG_CACHE_LIMIT) {
      const oldest = this.sourceLangCache.keys().next().value
      if (oldest !== undefined) this.sourceLangCache.delete(oldest)
    }
    this.sourceLangCache.set(refId, lang)
  }

  // ──────────────────────────────────────────────────────────── search ──

  private async searchIndex(
    searchOption: SearchDto,
    refType: SearchDocumentRefType | undefined,
  ): Promise<PaginationResult<any>> {
    const hasAdminAccess = RequestContext.hasAdminAccess()
    const { keyword, page, size } = searchOption
    const searchTerms = this.buildSearchTerms(keyword)
    const highlightKeywordFragments =
      this.buildHighlightKeywordFragments(keyword)
    const keywordRegexes = this.buildSearchKeywordRegexes(keyword)
    const candidateLimit = Math.min(
      SEARCH_MAX_CANDIDATES,
      Math.max(size * page * SEARCH_CANDIDATE_MULTIPLIER, size * 4),
    )

    const effectiveLang = this.resolveEffectiveLang(searchOption.lang)

    const mainHits = await this.searchInLang({
      lang: effectiveLang,
      keyword,
      searchTerms,
      keywordRegexes,
      refType,
      hasAdminAccess,
      candidateLimit,
    })

    const seen = new Set<string>(
      mainHits.map((doc) => `${doc.refType}:${doc.refId}`),
    )

    let fallbackRanked: RankedHit[] = []
    // Simplified fallback: if effectiveLang differs from the default source
    // language, also query the default lang index for refs we haven't yet
    // matched. A future revision can resolve per-ref source_lang precisely;
    // here we trade accuracy for one extra index lookup.
    if (effectiveLang !== SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG) {
      const fallbackHits = await this.searchInLang({
        lang: SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG,
        keyword,
        searchTerms,
        keywordRegexes,
        refType,
        hasAdminAccess,
        candidateLimit,
      })
      fallbackRanked = fallbackHits
        .filter((doc) => !seen.has(`${doc.refType}:${doc.refId}`))
        .map((doc) => ({
          ...doc,
          __isFallback: true,
          __searchWeight: (doc.__searchWeight ?? 0) * SEARCH_FALLBACK_DISCOUNT,
        }))
    }

    const merged: RankedHit[] = [...mainHits, ...fallbackRanked]
    merged.sort((a, b) => {
      const wa = a.__searchWeight ?? 0
      const wb = b.__searchWeight ?? 0
      if (wa !== wb) return wb - wa
      const ta = new Date(a.modifiedAt ?? a.createdAt ?? 0).valueOf()
      const tb = new Date(b.modifiedAt ?? b.createdAt ?? 0).valueOf()
      return tb - ta
    })

    const start = (page - 1) * size
    const pageHits = merged.slice(start, start + size)
    const data = await this.loadSearchResultData(
      pageHits,
      hasAdminAccess,
      highlightKeywordFragments,
      searchTerms,
    )
    const output = refType ? data.map(({ type, ...item }) => item) : data

    return {
      data: output,
      pagination: paginationOf(merged.length, page, size),
    }
  }

  private async searchInLang(opts: {
    lang: string
    keyword: string
    searchTerms: string[]
    keywordRegexes: RegExp[]
    refType: SearchDocumentRefType | undefined
    hasAdminAccess: boolean
    candidateLimit: number
  }): Promise<RankedHit[]> {
    const {
      lang,
      keyword,
      searchTerms,
      keywordRegexes,
      refType,
      hasAdminAccess,
      candidateLimit,
    } = opts

    const [
      termCandidates,
      textCandidates,
      regexCandidates,
      corpusStats,
      termDocumentFrequency,
    ] = await Promise.all([
      this.searchByTerms(
        searchTerms,
        refType,
        lang,
        hasAdminAccess,
        candidateLimit,
      ),
      this.searchByText(keyword, refType, lang, hasAdminAccess, candidateLimit),
      this.searchByRegex(
        keywordRegexes,
        refType,
        lang,
        hasAdminAccess,
        candidateLimit,
      ),
      this.searchRepository.findCorpusStatsByLang(lang, refType, {
        hasAdminAccess,
      }),
      this.getTermDocumentFrequency(searchTerms, refType, lang, hasAdminAccess),
    ])

    const merged = new Map<string, SearchDocumentLean>()
    for (const doc of [
      ...termCandidates,
      ...textCandidates,
      ...regexCandidates,
    ]) {
      merged.set(this.getSearchDocumentKey(doc), doc)
    }

    return this.rankSearchHits(
      [...merged.values()],
      keywordRegexes,
      searchTerms,
      corpusStats,
      termDocumentFrequency,
    )
  }

  private resolveEffectiveLang(explicitLang?: string) {
    const trim = (s: string | undefined) => s?.trim().toLowerCase() || undefined
    return (
      trim(explicitLang) ??
      trim(RequestContext.currentLang()) ??
      SEARCH_DOCUMENT_DEFAULT_SOURCE_LANG
    )
  }

  private async searchByTerms(
    searchTerms: string[],
    refType: SearchDocumentRefType | undefined,
    lang: string,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!searchTerms.length) return []
    const docs = await this.searchRepository.findByTerms(
      searchTerms,
      refType,
      lang,
      limit,
    )
    return docs.filter((doc) => this.isVisible(doc, hasAdminAccess))
  }

  private async searchByText(
    keyword: string,
    refType: SearchDocumentRefType | undefined,
    lang: string,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!keyword.trim()) return []
    const docs = await this.searchRepository.findByKeyword(
      keyword,
      refType,
      lang,
      limit,
    )
    return docs.filter((doc) => this.isVisible(doc, hasAdminAccess))
  }

  private async searchByRegex(
    keywordRegexes: RegExp[],
    refType: SearchDocumentRefType | undefined,
    lang: string,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!keywordRegexes.length) return []
    const candidates = await this.searchRepository.findAll(refType, lang)
    return candidates
      .filter((doc) => this.isVisible(doc, hasAdminAccess))
      .filter((doc) =>
        keywordRegexes.some(
          (regex) => regex.test(doc.title) || regex.test(doc.searchText),
        ),
      )
      .slice(0, limit)
  }

  private async getTermDocumentFrequency(
    searchTerms: string[],
    refType: SearchDocumentRefType | undefined,
    lang: string,
    hasAdminAccess: boolean,
  ) {
    if (!searchTerms.length) {
      return new Map<string, number>()
    }

    const docs = (
      await this.searchRepository.findByTerms(
        searchTerms,
        refType,
        lang,
        SEARCH_MAX_CANDIDATES,
      )
    ).filter((doc) => this.isVisible(doc, hasAdminAccess))
    const searchTermSet = new Set(searchTerms)
    const counts = new Map<string, number>()
    for (const doc of docs) {
      const matchedTerms = new Set<string>()
      for (const term of doc.terms) {
        if (searchTermSet.has(term)) matchedTerms.add(term)
      }
      for (const term of matchedTerms) {
        counts.set(term, (counts.get(term) ?? 0) + 1)
      }
    }
    return counts
  }

  private isVisible(
    doc: Pick<
      SearchDocumentRow,
      'refType' | 'isPublished' | 'hasPassword' | 'publicAt'
    >,
    hasAdminAccess: boolean,
  ) {
    if (hasAdminAccess) return true
    const now = new Date()
    if (doc.refType === 'post') return doc.isPublished !== false
    if (doc.refType === 'page') return true
    return (
      doc.isPublished &&
      !doc.hasPassword &&
      (!doc.publicAt || doc.publicAt <= now)
    )
  }

  private async loadSearchResultData(
    hits: RankedHit[],
    hasAdminAccess: boolean,
    highlightKeywordFragments: string[],
    searchTerms: string[],
  ) {
    if (!hits.length) {
      return []
    }

    const idsByType = {
      post: [] as string[],
      note: [] as string[],
      page: [] as string[],
    }

    for (const hit of hits) {
      idsByType[hit.refType].push(hit.refId)
    }

    const now = new Date()
    const [posts, notes, pages] = await Promise.all([
      idsByType.post.length
        ? (await this.postService.findManyByIds(idsByType.post)).filter(
            (post) => hasAdminAccess || post.isPublished !== false,
          )
        : [],
      idsByType.note.length
        ? (await this.noteService.findManyByIds(idsByType.note)).filter(
            (note) =>
              hasAdminAccess ||
              (note.isPublished && (!note.publicAt || note.publicAt <= now)),
          )
        : [],
      idsByType.page.length
        ? this.pageService.findManyByIds(idsByType.page)
        : [],
    ])

    const map = new Map<string, any>()
    for (const post of posts) {
      const publicPost = hasAdminAccess
        ? post
        : this.toPublicArticleFields(post as any)
      map.set(`post:${post.id}`, { ...publicPost, type: 'post' as const })
    }
    for (const note of notes) {
      map.set(`note:${note.id}`, { ...note, type: 'note' as const })
    }
    for (const page of pages) {
      map.set(`page:${page.id}`, { ...page, type: 'page' as const })
    }

    return hits
      .map((hit) => {
        const item = map.get(`${hit.refType}:${hit.refId}`)
        if (!item) {
          return null
        }

        // Surface the hit's own title/snippet/lang so translated rows show
        // through to the client without an extra translateArticle round trip.
        return {
          ...item,
          title: hit.title,
          lang: hit.lang,
          isFallback: hit.__isFallback,
          highlight: this.buildSearchHighlight(
            hit,
            highlightKeywordFragments,
            searchTerms,
          ),
        }
      })
      .filter(Boolean)
  }

  private async loadSourceDocument(refType: SearchDocumentRefType, id: string) {
    switch (refType) {
      case 'post': {
        return this.postService.findById(id)
      }
      case 'note': {
        return this.noteService.findById(id)
      }
      case 'page': {
        return this.pageService.findById(id)
      }
    }
  }

  private buildSearchKeywordRegexes(keyword: string) {
    return keyword
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((item) => new RegExp(escapeRegExp(item), 'gi'))
  }

  private buildSearchTerms(keyword: string) {
    return [
      ...new Set(
        tokenizeSearchText(normalizeSearchText(keyword), {
          includeCjkUnigrams: true,
          maxTokens: 48,
        }),
      ),
    ]
  }

  private buildHighlightKeywordFragments(keyword: string) {
    return normalizeSearchText(keyword).split(/\s+/).filter(Boolean)
  }

  private rankSearchHits(
    docs: SearchDocumentLean[],
    keywordRegexes: RegExp[],
    searchTerms: string[],
    corpusStats: SearchCorpusStats,
    termDocumentFrequency: Map<string, number>,
  ): RankedHit[] {
    return docs
      .map((doc) => ({
        ...doc,
        __isFallback: false,
        __searchWeight: this.calculateSearchWeight(
          doc,
          keywordRegexes,
          searchTerms,
          corpusStats,
          termDocumentFrequency,
        ),
      }))
      .sort((a, b) => {
        const wa = a.__searchWeight ?? 0
        const wb = b.__searchWeight ?? 0
        if (wa !== wb) return wb - wa
        const dateA = new Date(a.modifiedAt ?? a.createdAt ?? 0).valueOf()
        const dateB = new Date(b.modifiedAt ?? b.createdAt ?? 0).valueOf()
        return dateB - dateA
      }) as RankedHit[]
  }

  private calculateSearchWeight(
    doc: SearchDocumentLean,
    keywordRegexes: RegExp[],
    searchTerms: string[],
    corpusStats: SearchCorpusStats,
    termDocumentFrequency: Map<string, number>,
  ) {
    const title = doc.title ?? ''
    const text = doc.searchText ?? ''
    const loweredTitle = title.toLowerCase()
    const titleTermFrequency = doc.titleTermFreq ?? {}
    const bodyTermFrequency = doc.bodyTermFreq ?? {}
    let score = 0

    for (const searchTerm of searchTerms) {
      const df = termDocumentFrequency.get(searchTerm) ?? 0
      if (!df || !corpusStats.totalDocs) {
        continue
      }

      const idf = computeBm25Idf(corpusStats.totalDocs, df)
      const titleTf = titleTermFrequency[searchTerm] ?? 0
      const bodyTf = bodyTermFrequency[searchTerm] ?? 0

      score +=
        computeBm25Score({
          termFrequency: titleTf,
          documentLength: doc.titleLength ?? title.length,
          averageDocumentLength: corpusStats.avgTitleLength,
          idf,
        }) * SEARCH_BM25_TITLE_WEIGHT
      score +=
        computeBm25Score({
          termFrequency: bodyTf,
          documentLength: doc.bodyLength ?? text.length,
          averageDocumentLength: corpusStats.avgBodyLength,
          idf,
        }) * SEARCH_BM25_BODY_WEIGHT
    }

    for (const keywordRegex of keywordRegexes) {
      const keyword = keywordRegex.source.toLowerCase()
      if (loweredTitle === keyword) {
        score += SEARCH_EXACT_TITLE_BONUS
      } else if (loweredTitle.startsWith(keyword)) {
        score += SEARCH_PREFIX_TITLE_BONUS
      }

      score += this.countKeywordMatches(title, keywordRegex) * 6
      score += this.countKeywordMatches(text, keywordRegex) * 1.5
    }

    return score
  }

  private countKeywordMatches(text: string, keywordRegex: RegExp) {
    if (!text) return 0
    const safeRegex = new RegExp(keywordRegex.source, keywordRegex.flags)
    return text.match(safeRegex)?.length ?? 0
  }

  private getSearchDocumentKey(
    doc: Pick<SearchDocumentRow, 'refType' | 'refId'>,
  ) {
    return `${doc.refType}:${doc.refId}`
  }

  private buildSearchHighlight(
    doc: SearchDocumentLean,
    highlightKeywordFragments: string[],
    searchTerms: string[],
  ): SearchHighlight {
    const keywords = this.buildMatchedHighlightKeywords(
      doc,
      highlightKeywordFragments,
      searchTerms,
    )

    return {
      keywords,
      snippet: this.buildSearchSnippet(doc.searchText ?? '', keywords),
    }
  }

  private buildMatchedHighlightKeywords(
    doc: SearchDocumentLean,
    highlightKeywordFragments: string[],
    searchTerms: string[],
  ) {
    // doc.title preserves original case for display; lowercase here so the
    // (already lowercased) keyword fragments match case-insensitively.
    const loweredTitle = (doc.title ?? '').toLowerCase()
    const text = doc.searchText ?? ''
    const docTerms = new Set([
      ...Object.keys(doc.titleTermFreq ?? {}),
      ...Object.keys(doc.bodyTermFreq ?? {}),
    ])
    const candidates = new Set<string>()

    for (const fragment of highlightKeywordFragments) {
      if (
        fragment &&
        (loweredTitle.includes(fragment) || text.includes(fragment))
      ) {
        candidates.add(fragment)
      }
    }

    for (const term of searchTerms) {
      if (docTerms.has(term)) {
        candidates.add(term)
      }
    }

    const compactKeywords: string[] = []
    for (const candidate of [...candidates].sort((a, b) => {
      if (a.length !== b.length) {
        return b.length - a.length
      }
      return a.localeCompare(b)
    })) {
      if (compactKeywords.some((keyword) => keyword.includes(candidate))) {
        continue
      }
      compactKeywords.push(candidate)
      if (compactKeywords.length >= 6) {
        break
      }
    }

    return compactKeywords
  }

  private buildSearchSnippet(text: string, keywords: string[]) {
    if (!text || !keywords.length) {
      return null
    }

    const match = keywords
      .map((keyword) => ({ keyword, index: text.indexOf(keyword) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => {
        if (a.index !== b.index) {
          return a.index - b.index
        }
        return b.keyword.length - a.keyword.length
      })[0]

    if (!match) {
      return null
    }

    const contextBefore = 36
    const contextAfter = 84
    const sliceStart = Math.max(0, match.index - contextBefore)
    const sliceEnd = Math.min(
      text.length,
      match.index + match.keyword.length + contextAfter,
    )
    const prefix = sliceStart > 0 ? '...' : ''
    const suffix = sliceEnd < text.length ? '...' : ''

    return `${prefix}${text.slice(sliceStart, sliceEnd).trim()}${suffix}`
  }
}

function escapeRegExp(input: string) {
  return input.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')
}

function computeBm25Idf(totalDocs: number, documentFrequency: number) {
  return Math.log(
    1 + (totalDocs - documentFrequency + 0.5) / (documentFrequency + 0.5),
  )
}

function computeBm25Score(input: {
  termFrequency: number
  documentLength: number
  averageDocumentLength: number
  idf: number
}) {
  if (!input.termFrequency) {
    return 0
  }

  const normalizedLength =
    1 -
    SEARCH_BM25_B +
    SEARCH_BM25_B *
      (input.documentLength / Math.max(input.averageDocumentLength, 1))

  const numerator = input.termFrequency * (SEARCH_BM25_K1 + 1)
  const denominator = input.termFrequency + SEARCH_BM25_K1 * normalizedLength

  return input.idf * (numerator / denominator)
}

// computeSourceHash re-exported for ergonomic access in tests.
export { computeSourceHash }
