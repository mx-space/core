import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { ReturnModelType } from '@typegoose/typegoose'
import type { QueryFilter } from 'mongoose'

import { RequestContext } from '~/common/contexts/request.context'
import { BusinessEvents } from '~/constants/business-event.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import type { SearchDto } from '~/modules/search/search.schema'
import type { Pagination } from '~/shared/interface/paginator.interface'
import { InjectModel } from '~/transformers/model.transformer'

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
import {
  SearchDocumentModel,
  type SearchDocumentRefType,
} from './search-document.model'
import {
  buildSearchDocument,
  normalizeSearchText,
  tokenizeSearchText,
} from './search-document.util'

type SearchDocumentLean = SearchDocumentModel & {
  id?: string
  _id?: { toString: () => string }
}

const SEARCH_SOURCE_PROJECTIONS: Record<SearchDocumentRefType, string> = {
  post: 'title text content contentFormat slug created modified isPublished',
  page: 'title text content contentFormat slug created modified',
  note: 'title text content contentFormat nid slug created modified isPublished publicAt +password',
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

    @InjectModel(SearchDocumentModel)
    private readonly searchDocumentModel: ReturnModelType<
      typeof SearchDocumentModel
    >,
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
    await this.searchDocumentModel.deleteMany({})

    if (documents.length) {
      await this.searchDocumentModel.insertMany(documents, { ordered: false })
    }

    this.logger.log(`rebuilt local search index, total: ${documents.length}`)

    return { total: documents.length }
  }

  async buildSearchDocuments() {
    const [posts, pages, notes] = await Promise.all([
      this.loadSearchSourceDocs(this.postService.model, 'post'),
      this.loadSearchSourceDocs(this.pageService.model, 'page'),
      this.loadSearchSourceDocs(this.noteService.model, 'note'),
    ])

    return [
      ...posts.map((doc) => this.toSearchDocument('post', doc)),
      ...pages.map((doc) => this.toSearchDocument('page', doc)),
      ...notes.map((doc) => this.toSearchDocument('note', doc)),
    ]
  }

  private loadSearchSourceDocs(
    model: { find: () => any },
    refType: SearchDocumentRefType,
  ) {
    return model.find().select(SEARCH_SOURCE_PROJECTIONS[refType]).lean()
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

    return this.searchDocumentModel
      .find({
        $and: [
          this.buildVisibilityQuery(refType, hasAdminAccess),
          { terms: { $in: searchTerms } },
        ],
      })
      .select(this.searchProjection)
      .limit(limit)
      .lean()
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

    return this.searchDocumentModel
      .find({
        $and: [
          this.buildVisibilityQuery(refType, hasAdminAccess),
          { $text: { $search: keyword.trim() } },
        ],
      })
      .select(this.searchProjection)
      .limit(limit)
      .lean()
  }

  private async searchByRegex(
    keywordRegexes: RegExp[],
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
    limit: number,
  ) {
    const clauses = this.buildRegexClauses(keywordRegexes)
    if (!clauses.length) {
      return []
    }

    return this.searchDocumentModel
      .find({
        $and: [
          this.buildVisibilityQuery(refType, hasAdminAccess),
          { $or: clauses },
        ],
      })
      .select(this.searchProjection)
      .limit(limit)
      .lean()
  }

  private async getCorpusStats(
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
  ): Promise<SearchCorpusStats> {
    const visibilityMatch = this.buildVisibilityQuery(
      refType,
      hasAdminAccess,
    ) as Record<string, any>

    const [stats] = await this.searchDocumentModel.aggregate<{
      totalDocs: number
      avgTitleLength: number
      avgBodyLength: number
    }>([
      { $match: visibilityMatch },
      {
        $group: {
          _id: null,
          totalDocs: { $sum: 1 },
          avgTitleLength: { $avg: '$titleLength' },
          avgBodyLength: { $avg: '$bodyLength' },
        },
      },
    ])

    return {
      totalDocs: stats?.totalDocs ?? 0,
      avgTitleLength: stats?.avgTitleLength ?? 1,
      avgBodyLength: stats?.avgBodyLength ?? 1,
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

    const visibilityMatch = this.buildVisibilityQuery(
      refType,
      hasAdminAccess,
    ) as Record<string, any>

    const matched = await this.searchDocumentModel.aggregate<{
      _id: string
      count: number
    }>([
      {
        $match: {
          $and: [visibilityMatch, { terms: { $in: searchTerms } }],
        },
      },
      { $unwind: '$terms' },
      { $match: { terms: { $in: searchTerms } } },
      { $group: { _id: '$terms', count: { $sum: 1 } } },
    ])

    return new Map(matched.map((item) => [item._id, item.count]))
  }

  private buildVisibilityQuery(
    refType: SearchDocumentRefType | undefined,
    hasAdminAccess: boolean,
  ): QueryFilter<SearchDocumentModel> {
    if (hasAdminAccess) {
      return refType ? { refType } : {}
    }

    const now = new Date()
    if (refType === 'post') {
      return {
        refType,
        isPublished: { $ne: false },
      }
    }
    if (refType === 'page') {
      return { refType }
    }
    if (refType === 'note') {
      return {
        refType,
        isPublished: true,
        hasPassword: { $ne: true },
        $or: [
          { publicAt: null },
          { publicAt: { $exists: false } },
          { publicAt: { $lte: now } },
        ],
      }
    }

    return {
      $or: [
        { refType: 'page' },
        { refType: 'post', isPublished: { $ne: false } },
        {
          refType: 'note',
          isPublished: true,
          hasPassword: { $ne: true },
          $or: [
            { publicAt: null },
            { publicAt: { $exists: false } },
            { publicAt: { $lte: now } },
          ],
        },
      ],
    }
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
        ? this.postService.model
            .find({
              _id: { $in: idsByType.post },
              ...(hasAdminAccess ? {} : { isPublished: { $ne: false } }),
            })
            .select('_id title created modified categoryId slug')
            .populate('category', 'name slug')
            .lean({ getters: true, autopopulate: true })
        : [],
      idsByType.note.length
        ? this.noteService.model
            .find({
              _id: { $in: idsByType.note },
              ...(hasAdminAccess
                ? {}
                : {
                    isPublished: true,
                    $and: [
                      {
                        $or: [
                          { password: null },
                          { password: '' },
                          { password: { $exists: false } },
                        ],
                      },
                      {
                        $or: [
                          { publicAt: null },
                          { publicAt: { $exists: false } },
                          { publicAt: { $lte: now } },
                        ],
                      },
                    ],
                  }),
            })
            .select('_id title created modified nid slug')
            .lean({ getters: true, autopopulate: true })
        : [],
      idsByType.page.length
        ? this.pageService.model
            .find({ _id: { $in: idsByType.page } })
            .select('_id title created modified slug subtitle')
            .lean({ getters: true })
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

    await this.searchDocumentModel.updateOne(
      { refType, refId: id },
      { $set: this.toSearchDocument(refType, sourceDocument) },
      { upsert: true },
    )
  }

  private async deleteSearchDocument(
    refType: SearchDocumentRefType,
    id: string,
  ) {
    await this.searchDocumentModel.deleteOne({ refType, refId: id })
  }

  private async loadSourceDocument(refType: SearchDocumentRefType, id: string) {
    const projection = SEARCH_SOURCE_PROJECTIONS[refType]
    switch (refType) {
      case 'post': {
        return this.postService.model.findById(id).select(projection).lean()
      }
      case 'note': {
        return this.noteService.model.findById(id).select(projection).lean()
      }
      case 'page': {
        return this.pageService.model.findById(id).select(projection).lean()
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
    doc: Pick<SearchDocumentModel, 'refType' | 'refId'>,
  ) {
    return `${doc.refType}:${doc.refId}`
  }

  private get searchProjection() {
    return {
      refType: 1,
      refId: 1,
      title: 1,
      searchText: 1,
      terms: 1,
      titleTermFreq: 1,
      bodyTermFreq: 1,
      titleLength: 1,
      bodyLength: 1,
      created: 1,
      modified: 1,
    }
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
