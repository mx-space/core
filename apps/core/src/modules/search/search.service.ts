import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { RequestContext } from '~/common/contexts/request.context'
import { BusinessEvents } from '~/constants/business-event.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import type { SearchDto } from '~/modules/search/search.schema'
import type { Pagination } from '~/shared/interface/paginator.interface'

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
  SEARCH_MAX_CANDIDATES,
  SEARCH_PREFIX_TITLE_BONUS,
} from './search.constants'
import { type SearchDocumentRow, SearchRepository } from './search.repository'
import {
  SearchDocumentModel,
  type SearchDocumentRefType,
} from './search-document.model'
import {
  buildSearchDocument,
  normalizeSearchText,
  tokenizeSearchText,
} from './search-document.util'

type SearchDocumentLean = SearchDocumentRow & {
  created?: Date | null
  modified?: Date | null
  id?: string
  _id?: { toString: () => string }
}

type SearchCorpusStats = {
  totalDocs: number
  avgTitleLength: number
  avgBodyLength: number
}

type SearchHighlight = {
  keywords: string[]
  snippet: string | null
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,

    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,

    private readonly searchRepository: SearchRepository,
  ) {}

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

  async rebuildSearchDocuments() {
    const documents = await this.buildSearchDocuments()
    await this.searchRepository.deleteAll()

    for (const document of documents) {
      await this.searchRepository.upsert(document as any)
    }

    this.logger.log(`rebuilt local search index, total: ${documents.length}`)

    return { total: documents.length }
  }

  async buildSearchDocuments() {
    const [posts, pages, notes] = await Promise.all([
      this.postService.findRecent(100),
      this.pageService.findRecent(100),
      this.noteService.findRecent(100),
    ])

    return [
      ...posts.map((doc) => this.toSearchDocument('post', doc)),
      ...pages.map((doc) => this.toSearchDocument('page', doc)),
      ...notes.map((doc) => this.toSearchDocument('note', doc)),
    ]
  }

  @OnEvent(BusinessEvents.POST_CREATE)
  @OnEvent(BusinessEvents.POST_UPDATE)
  async onPostCreate(post: { id: string }) {
    await this.upsertSearchDocument('post', post.id)
  }

  @OnEvent(BusinessEvents.NOTE_CREATE)
  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async onNoteCreate(note: { id: string }) {
    await this.upsertSearchDocument('note', note.id)
  }

  @OnEvent(BusinessEvents.PAGE_CREATE)
  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async onPageCreate(page: { id: string }) {
    await this.upsertSearchDocument('page', page.id)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  async onPostDelete({ id }: { id: string }) {
    await this.deleteSearchDocument('post', id)
  }

  @OnEvent(BusinessEvents.NOTE_DELETE)
  async onNoteDelete({ id }: { id: string }) {
    await this.deleteSearchDocument('note', id)
  }

  @OnEvent(BusinessEvents.PAGE_DELETE)
  async onPageDelete({ id }: { id: string }) {
    await this.deleteSearchDocument('page', id)
  }

  private async searchIndex(
    searchOption: SearchDto,
    refType: SearchDocumentRefType | undefined,
  ): Promise<Pagination<any>> {
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

    const [
      termCandidates,
      textCandidates,
      regexCandidates,
      corpusStats,
      termDocumentFrequency,
    ] = await Promise.all([
      this.searchByTerms(searchTerms, refType, hasAdminAccess, candidateLimit),
      this.searchByText(keyword, refType, hasAdminAccess, candidateLimit),
      this.searchByRegex(
        keywordRegexes,
        refType,
        hasAdminAccess,
        candidateLimit,
      ),
      this.getCorpusStats(refType, hasAdminAccess),
      this.getTermDocumentFrequency(searchTerms, refType, hasAdminAccess),
    ])

    const merged = new Map<string, SearchDocumentLean>()
    for (const doc of [
      ...termCandidates,
      ...textCandidates,
      ...regexCandidates,
    ]) {
      merged.set(this.getSearchDocumentKey(doc), doc)
    }

    const ranked = this.rankSearchHits(
      [...merged.values()],
      keywordRegexes,
      searchTerms,
      corpusStats,
      termDocumentFrequency,
    )
    const start = (page - 1) * size
    const pageHits = ranked.slice(start, start + size)
    const data = await this.loadSearchResultData(
      pageHits,
      hasAdminAccess,
      highlightKeywordFragments,
      searchTerms,
    )
    const output = refType ? data.map(({ type, ...item }) => item) : data

    return {
      data: output,
      pagination: {
        total: ranked.length,
        currentPage: page,
        totalPage: Math.ceil(ranked.length / size) || 1,
        size,
        hasNextPage: start + size < ranked.length,
        hasPrevPage: page > 1,
      },
    }
  }

  private async searchByTerms(
    searchTerms: string[],
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!searchTerms.length) {
      return []
    }

    return (
      await this.searchRepository.findByTerms(searchTerms, refType, limit)
    ).filter((doc) => this.isVisible(doc, hasAdminAccess))
  }

  private async searchByText(
    keyword: string,
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!keyword.trim()) {
      return []
    }

    return (
      await this.searchRepository.findByKeyword(keyword, refType, limit)
    ).filter((doc) => this.isVisible(doc, hasAdminAccess))
  }

  private async searchByRegex(
    keywordRegexes: RegExp[],
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    if (!keywordRegexes.length) return []
    const candidates = await this.searchRepository.findAll(refType)
    return candidates
      .filter((doc) => this.isVisible(doc, hasAdminAccess))
      .filter((doc) =>
        keywordRegexes.some(
          (regex) => regex.test(doc.title) || regex.test(doc.searchText),
        ),
      )
      .slice(0, limit)
  }

  private async getCorpusStats(
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
  ): Promise<SearchCorpusStats> {
    const docs = (await this.searchRepository.findAll(refType)).filter((doc) =>
      this.isVisible(doc, hasAdminAccess),
    )
    const totalDocs = docs.length
    const totalTitleLength = docs.reduce((sum, doc) => sum + doc.titleLength, 0)
    const totalBodyLength = docs.reduce((sum, doc) => sum + doc.bodyLength, 0)

    return {
      totalDocs,
      avgTitleLength: totalDocs ? totalTitleLength / totalDocs : 1,
      avgBodyLength: totalDocs ? totalBodyLength / totalDocs : 1,
    }
  }

  private async getTermDocumentFrequency(
    searchTerms: string[],
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
  ) {
    if (!searchTerms.length) {
      return new Map<string, number>()
    }

    const docs = (
      await this.searchRepository.findByTerms(
        searchTerms,
        refType,
        SEARCH_MAX_CANDIDATES,
      )
    ).filter((doc) => this.isVisible(doc, hasAdminAccess))
    const counts = new Map<string, number>()
    for (const doc of docs) {
      for (const term of new Set(
        doc.terms.filter((t) => searchTerms.includes(t)),
      )) {
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
    hits: Array<SearchDocumentLean & { refType: SearchDocumentRefType }>,
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
      map.set(`post:${post.id}`, { ...post, type: 'post' as const })
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

        return {
          ...item,
          highlight: this.buildSearchHighlight(
            hit,
            highlightKeywordFragments,
            searchTerms,
          ),
        }
      })
      .filter(Boolean)
  }

  private async upsertSearchDocument(
    refType: SearchDocumentRefType,
    id: string,
  ) {
    const sourceDocument = await this.loadSourceDocument(refType, id)
    if (!sourceDocument) {
      await this.deleteSearchDocument(refType, id)
      return
    }

    await this.searchRepository.upsert(
      this.toSearchDocument(refType, sourceDocument) as any,
    )
  }

  private async deleteSearchDocument(
    refType: SearchDocumentRefType,
    id: string,
  ) {
    await this.searchRepository.deleteByRef(refType, id)
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

  private toSearchDocument(
    refType: SearchDocumentRefType,
    data: Record<string, any>,
  ): SearchDocumentModel {
    return buildSearchDocument(refType, data) as SearchDocumentModel
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

  private buildRegexClauses(keywordRegexes: RegExp[]) {
    return keywordRegexes.flatMap((regex) => [
      { title: regex },
      { searchText: regex },
    ])
  }

  private rankSearchHits(
    docs: SearchDocumentLean[],
    keywordRegexes: RegExp[],
    searchTerms: string[],
    corpusStats: SearchCorpusStats,
    termDocumentFrequency: Map<string, number>,
  ): Array<SearchDocumentLean & { refType: SearchDocumentRefType }> {
    return docs
      .map((doc) => ({
        ...doc,
        __searchWeight: this.calculateSearchWeight(
          doc,
          keywordRegexes,
          searchTerms,
          corpusStats,
          termDocumentFrequency,
        ),
      }))
      .sort((a, b) => {
        if (a.__searchWeight !== b.__searchWeight) {
          return b.__searchWeight - a.__searchWeight
        }

        const dateA = new Date(a.modified ?? a.created ?? 0).valueOf()
        const dateB = new Date(b.modified ?? b.created ?? 0).valueOf()
        return dateB - dateA
      })
      .map(
        ({ __searchWeight, ...doc }) =>
          doc as SearchDocumentLean & {
            refType: SearchDocumentRefType
          },
      )
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
    const title = doc.title ?? ''
    const text = doc.searchText ?? ''
    const docTerms = new Set([
      ...Object.keys(doc.titleTermFreq ?? {}),
      ...Object.keys(doc.bodyTermFreq ?? {}),
    ])
    const candidates = new Set<string>()

    for (const fragment of highlightKeywordFragments) {
      if (fragment && (title.includes(fragment) || text.includes(fragment))) {
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
