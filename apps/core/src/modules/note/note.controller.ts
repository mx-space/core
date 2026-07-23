import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import type {
  ArticleTranslation,
  EnrichmentEntry,
} from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import {
  applyArticleTranslationInPlace,
  applyTranslationEntriesInPlace,
  type ArticleTranslationInput,
  buildArticleTranslationMeta,
  type EntryMaps,
  type EntryRule,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { truncateAtBoundary } from '~/utils/text-summary.util'

import { DEFAULT_SUMMARY_LANG } from '../ai/ai.constants'
import { AiInsightsService } from '../ai/ai-insights/ai-insights.service'
import { parseLanguageCode } from '../ai/ai-language.util'
import { AiSummaryService } from '../ai/ai-summary/ai-summary.service'
import { EnrichmentService } from '../enrichment/enrichment.service'
import {
  ListQueryDto,
  NidType,
  NoteDto,
  NotePasswordQueryDto,
  NoteQueryDto,
  NoteSlugDateParamsDto,
  NoteTopicPagerDto,
  PartialNoteDto,
  SetNotePublishStatusDto,
} from './note.schema'
import { NoteService } from './note.service'
import type { NoteModel } from './note.types'
import { NoteMetaBuilder } from './note-meta-builder'

const NOTE_ENTRY_RULES: ReadonlyArray<EntryRule> = [
  { path: 'topic.name', keyPath: 'topic.name', mode: 'entity', idField: 'id' },
  {
    path: 'topic.introduce',
    keyPath: 'topic.introduce',
    mode: 'entity',
    idField: 'id',
  },
  {
    path: 'topic.description',
    keyPath: 'topic.description',
    mode: 'entity',
    idField: 'id',
  },
  { path: 'mood', keyPath: 'note.mood', mode: 'dict' },
  { path: 'weather', keyPath: 'note.weather', mode: 'dict' },
]

@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,
    private readonly translationService: TranslationService,
    private readonly aiSummaryService: AiSummaryService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly lexicalService: LexicalService,
    private readonly enrichmentService: EnrichmentService,
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  private toArticleTranslationInput(note: NoteModel): ArticleTranslationInput {
    return {
      id: String(note.id),
      title: note.title,
      text: note.text ?? '',
      meta: note.meta as { lang?: string } | undefined,
      contentFormat: note.contentFormat,
      content: note.content,
      modifiedAt: note.modifiedAt,
      createdAt: note.createdAt,
    }
  }

  private toAdjacentNavNote(
    note: NoteModel | null | undefined,
  ): Pick<
    NoteModel,
    'id' | 'nid' | 'title' | 'slug' | 'createdAt' | 'isPublished'
  > | null {
    if (!note) return null
    return {
      id: note.id,
      nid: note.nid,
      title: note.title,
      slug: note.slug,
      createdAt: note.createdAt,
      isPublished: note.isPublished,
    }
  }

  private async applyCachedAdjacentTitles(
    notes: Array<NoteModel | null | undefined>,
    lang?: string,
  ): Promise<void> {
    if (!lang) return
    const ids = notes
      .filter((n): n is NoteModel => Boolean(n?.id))
      .map((n) => String(n.id))
    if (!ids.length) return

    const titleMap = await this.translationService.getCachedTitles(ids, lang)
    if (!titleMap.size) return

    for (const note of notes) {
      if (!note?.id) continue
      const title = titleMap.get(String(note.id))
      if (title) note.title = title
    }
  }

  private fallbackSummary(doc: NoteModel, maxLength: number): string | null {
    const locale =
      typeof (doc.meta as { lang?: unknown } | undefined)?.lang === 'string'
        ? (doc.meta as { lang: string }).lang
        : undefined
    if (doc.contentFormat === 'lexical' && typeof doc.content === 'string') {
      const summary = this.lexicalService.extractSummaryFromLexical(
        doc.content,
        maxLength,
        locale,
      )
      if (summary) return summary
    }
    if (typeof doc.text !== 'string' || !doc.text) return null
    return truncateAtBoundary(doc.text, maxLength, locale)
  }

  private async batchEntryTranslations(
    lang: string,
    notes: Array<NoteModel | null | undefined>,
  ): Promise<EntryMaps> {
    const topicIds = new Set<string>()
    const moods = new Set<string>()
    const weathers = new Set<string>()

    for (const note of notes) {
      if (!note) continue
      if (note.topic?.id) topicIds.add(String(note.topic.id))
      if (note.mood) moods.add(note.mood)
      if (note.weather) weathers.add(note.weather)
    }

    return this.translationEntryService.getTranslationsBatch(lang, {
      entityLookups:
        topicIds.size > 0
          ? [
              { keyPath: 'topic.name', lookupKeys: topicIds },
              { keyPath: 'topic.introduce', lookupKeys: topicIds },
              { keyPath: 'topic.description', lookupKeys: topicIds },
            ]
          : [],
      dictLookups: [
        ...(moods.size > 0
          ? [{ keyPath: 'note.mood' as const, sourceTexts: moods }]
          : []),
        ...(weathers.size > 0
          ? [{ keyPath: 'note.weather' as const, sourceTexts: weathers }]
          : []),
      ],
    })
  }

  private async buildPublicNoteResponse(
    current: NoteModel,
    isAuthenticated: boolean,
    query: NotePasswordQueryDto,
    ip: string,
    lang?: string,
  ) {
    const { password, single: isSingle } = query
    const visibleOnly = !isAuthenticated

    if (!isAuthenticated) {
      current.location = null
      current.coordinates = null
    }

    current.text =
      !isAuthenticated && this.noteService.checkNoteIsSecret(current)
        ? ''
        : current.text

    if (
      !(await this.noteService.checkPasswordToAccess(current.id, password)) &&
      !isAuthenticated
    ) {
      throw createAppException(AppErrorCode.NOTE_FORBIDDEN)
    }

    const [liked, translationResult] = await Promise.all([
      this.countingService
        .getThisRecordIsLiked(current.id!, ip)
        .catch(() => false),
      this.translationService.translateArticle({
        articleId: current.id!,
        targetLang: lang,
        allowHidden: Boolean(isAuthenticated || current.password),
        originalData: {
          title: current.title,
          text: current.text,
        },
      }),
    ])

    applyArticleTranslationInPlace(current, translationResult)

    const insightsLang = parseLanguageCode(lang)
    const [hasInsightsInLocale, summaryDoc] = await Promise.all([
      this.aiInsightsService
        .hasInsightsInLang(current.id!, insightsLang)
        .catch(() => false),
      this.aiSummaryService.getSummaryForPublicMeta(current.id!, insightsLang),
    ])

    const metaBuilder = new NoteMetaBuilder()
      .view('detail')
      .interaction({ isLiked: liked })
      .insights({ hasInLocale: hasInsightsInLocale })

    if (summaryDoc) {
      metaBuilder.summary({
        id: summaryDoc.id,
        text: summaryDoc.summary,
        lang: summaryDoc.lang ?? insightsLang,
        createdAt: summaryDoc.createdAt,
      })
    }

    if (isSingle) {
      if (lang) {
        const entryMaps = await this.batchEntryTranslations(lang, [current])
        applyTranslationEntriesInPlace(current, entryMaps, NOTE_ENTRY_RULES)
      }

      const translationMap = new Map([
        [
          String(current.id),
          {
            article: buildArticleTranslationMeta(
              translationResult,
              lang,
            ) as ArticleTranslation,
          },
        ],
      ])
      metaBuilder.translation(translationMap)

      const { enrichments, ...noteData } =
        await this.enrichmentService.attachEnrichments(current)
      metaBuilder.enrichments(enrichments as Record<string, EnrichmentEntry>)
      return withMeta(noteData, metaBuilder.build())
    }

    const [[prev], [next]] = await Promise.all([
      this.noteService.findByCreatedWindow(current.createdAt!, 'after', 1, {
        visibleOnly,
        excludeId: current.id,
      }),
      this.noteService.findByCreatedWindow(current.createdAt!, 'before', 1, {
        visibleOnly,
        excludeId: current.id,
      }),
    ])

    const translationMap = new Map([
      [
        String(current.id),
        {
          article: buildArticleTranslationMeta(
            translationResult,
            lang,
          ) as ArticleTranslation,
        },
      ],
    ])

    if (lang) {
      await this.applyCachedAdjacentTitles([prev, next], lang)

      const entryMaps = await this.batchEntryTranslations(lang, [current])
      applyTranslationEntriesInPlace(current, entryMaps, NOTE_ENTRY_RULES)
    }

    metaBuilder.translation(translationMap)

    const { enrichments, ...noteData } =
      await this.enrichmentService.attachEnrichments(current)
    metaBuilder.enrichments(enrichments as Record<string, EnrichmentEntry>)

    return withMeta(
      {
        ...noteData,
        next: this.toAdjacentNavNote(next),
        prev: this.toAdjacentNavNote(prev),
      },
      metaBuilder.build(),
    )
  }

  @Get('/')
  async getNotes(
    @HasAdminAccess() isAuthenticated: boolean,
    @Query() query: NoteQueryDto,
    @Lang() lang?: string,
  ) {
    const { size, page, sortBy, sortOrder, year, withSummary } = query

    const result = await this.noteService.listPaginated(page, size, {
      visibleOnly: !isAuthenticated,
      sortBy: sortBy as
        'createdAt' | 'modifiedAt' | 'title' | 'mood' | 'weather' | undefined,
      sortOrder: sortOrder === 'asc' ? 1 : -1,
      year,
      // Bodies are deleted from the response below when withSummary — skip
      // fetching them; notes missing a stored summary are backfilled by id.
      metaOnly: !!withSummary,
    })

    if (!isAuthenticated) {
      for (const doc of result.data) {
        doc.location = null
        doc.coordinates = null
      }
    }

    const [
      { results: translationResults, meta: translationMeta },
      summaryMap,
      entryMaps,
    ] = await Promise.all([
      this.translationService.collectArticleTranslations({
        articles: result.data
          .filter((doc) => typeof doc.text === 'string')
          .map((doc) => this.toArticleTranslationInput(doc)),
        targetLang: lang,
        fields: ['title', 'text', 'content', 'contentFormat'],
      }),
      withSummary
        ? this.aiSummaryService.batchGetSummariesByRefIds(
            result.data.map((d) => d.id),
            lang || DEFAULT_SUMMARY_LANG,
          )
        : null,
      lang ? this.batchEntryTranslations(lang, result.data) : null,
    ])

    for (const doc of result.data) {
      const tr = translationResults.get(String(doc.id))
      if (tr?.isTranslated) {
        applyArticleTranslationInPlace(doc, tr as any)
      }
    }

    if (summaryMap) {
      const SUMMARY_MAX_LENGTH = 150
      const missingIds = result.data
        .filter((doc) => !summaryMap.get(doc.id))
        .map((doc) => doc.id)
      const bodyById = new Map(
        missingIds.length
          ? (await this.noteService.findManyByIds(missingIds)).map(
              (note) => [note.id, note] as const,
            )
          : [],
      )
      for (const doc of result.data) {
        const plain = doc as any
        const stored = summaryMap.get(doc.id)
        if (stored == null) {
          const source = bodyById.get(doc.id)
          if (source) {
            const tr = translationResults.get(String(doc.id))
            if (tr?.isTranslated) {
              applyArticleTranslationInPlace(source as any, tr as any)
            }
          }
          plain.summary =
            this.fallbackSummary(
              (source ?? doc) as NoteModel,
              SUMMARY_MAX_LENGTH,
            ) ?? ''
        } else {
          plain.summary = stored
        }
        delete plain.text
        delete plain.content
      }
    }

    if (entryMaps) {
      for (const doc of result.data) {
        applyTranslationEntriesInPlace(doc, entryMaps, NOTE_ENTRY_RULES)
      }
    }

    const metaBuilder = new MetaObjectBuilder().view('card').pagination({
      page: result.pagination.currentPage,
      size: result.pagination.size,
      total: result.pagination.total,
      totalPages: result.pagination.totalPage,
    })

    if (translationMeta.size > 0) {
      metaBuilder.translation(translationMeta)
    }

    return withMeta(result.data, metaBuilder.build())
  }

  @Get(':id')
  async getOneNote(
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
  ) {
    const { id } = params
    const current = await this.noteService.findById(id)
    if (!current) {
      throw createAppException(AppErrorCode.NOTE_NOT_FOUND, { id })
    }

    if (!isAuthenticated && !current.isPublished) {
      throw createAppException(AppErrorCode.NOTE_NOT_FOUND, { id })
    }

    if (!isAuthenticated) {
      current.location = null
      current.coordinates = null
    }

    const { enrichments, ...noteData } =
      await this.enrichmentService.attachEnrichments(current)
    const metaBuilder = new MetaObjectBuilder().enrichments(
      enrichments as Record<string, EnrichmentEntry>,
    )
    return withMeta(noteData, metaBuilder.build())
  }

  @Get('/:year/:month/:day/:slug')
  async getNoteByDateAndSlug(
    @Param() params: NoteSlugDateParamsDto,
    @HasAdminAccess() isAuthenticated: boolean,
    @Query() query: NotePasswordQueryDto,
    @IpLocation() { ip }: IpRecord,
    @Lang() lang?: string,
  ) {
    const { year, month, day, slug } = params
    const current = await this.noteService.findOneByDateAndSlug(
      year,
      month,
      day,
      slug,
      { includeLocation: isAuthenticated },
    )

    if (!current || (!isAuthenticated && !current.isPublished)) {
      throw createAppException(AppErrorCode.NOTE_NOT_FOUND)
    }

    return this.buildPublicNoteResponse(
      current as NoteModel,
      isAuthenticated,
      query,
      ip,
      lang,
    )
  }

  @Get('/list/:id')
  async getNoteList(
    @Query() query: ListQueryDto,
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const { size = 10 } = query
    const half = size >> 1
    const { id } = params

    const currentDocument = await this.noteService.findById(id)
    if (!currentDocument) {
      return withMeta([], new MetaObjectBuilder().view('card').build())
    }

    const findAdjacent = (direction: 'prev' | 'next', count: number) => {
      if (count <= 0) return Promise.resolve([])
      return this.noteService.findByCreatedWindow(
        currentDocument.createdAt,
        direction === 'prev' ? 'after' : 'before',
        count,
        { visibleOnly: !isAuthenticated, excludeId: currentDocument.id },
      )
    }

    const [prevList, nextList] = await Promise.all([
      findAdjacent('prev', half - 1),
      findAdjacent('next', half ? half - 1 : 0),
    ])

    const merged = [...prevList, ...nextList, currentDocument].sort(
      (a, b) => (b.createdAt?.valueOf() ?? 0) - (a.createdAt?.valueOf() ?? 0),
    )

    const listData = merged.map((doc) => ({
      id: doc.id,
      title: doc.title,
      nid: doc.nid,
      slug: doc.slug,
      isPublished: doc.isPublished,
      createdAt: doc.createdAt,
    }))

    const { results: translationResults, meta: translationMeta } =
      await this.translationService.collectArticleTranslations({
        articles: listData.map((item) => ({
          id: String(item.id),
          title: item.title,
          text: '',
          createdAt: item.createdAt,
          modifiedAt: null,
        })),
        targetLang: lang,
        fields: ['title'],
      })

    for (const item of listData) {
      const tr = translationResults.get(String(item.id))
      if (tr?.isTranslated && tr.title) {
        item.title = tr.title
      }
    }

    const metaBuilder = new MetaObjectBuilder().view('card')
    if (translationMeta.size > 0) {
      metaBuilder.translation(translationMeta)
    }

    return withMeta(listData, metaBuilder.build())
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  create(@Body() body: NoteDto) {
    return this.noteService.create(body as unknown as NoteModel)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: NoteDto, @Param() params: EntityIdDto) {
    await this.noteService.updateById(params.id, body as unknown as NoteModel)
    return this.noteService.findOneByIdOrNid(params.id)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialNoteDto, @Param() params: EntityIdDto) {
    await this.noteService.updateById(
      params.id,
      body as unknown as Partial<NoteModel>,
    )
  }

  @Delete(':id')
  @Auth()
  async deleteNote(@Param() params: EntityIdDto) {
    await this.noteService.deleteById(params.id)
  }

  @Get('/latest')
  async getLatestOne(
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const result = await this.noteService.getLatestOne(
      isAuthenticated ? {} : this.noteService.publicNoteQueryCondition,
    )

    if (!result) return null
    const { latest, next } = result

    if (!isAuthenticated) {
      latest.location = null
      latest.coordinates = null
    }
    latest.text = this.noteService.checkNoteIsSecret(latest) ? '' : latest.text

    const translationResult = await this.translationService.translateArticle({
      articleId: latest.id!,
      targetLang: lang,
      allowHidden: Boolean(isAuthenticated),
      originalData: {
        title: latest.title,
        text: latest.text,
      },
    })

    applyArticleTranslationInPlace(latest, translationResult)

    if (lang) {
      await this.applyCachedAdjacentTitles([next], lang)

      const entryMaps = await this.batchEntryTranslations(lang, [latest])
      applyTranslationEntriesInPlace(latest, entryMaps, NOTE_ENTRY_RULES)
    }

    const insightsLang = parseLanguageCode(lang)
    const hasInsightsInLocale = await this.aiInsightsService
      .hasInsightsInLang(latest.id!, insightsLang)
      .catch(() => false)

    const { enrichments, ...latestData } =
      await this.enrichmentService.attachEnrichments(latest)

    const metaBuilder = new NoteMetaBuilder()
      .view('detail')
      .insights({ hasInLocale: hasInsightsInLocale })
      .enrichments(enrichments as Record<string, EnrichmentEntry>)

    const translationMap = new Map([
      [
        String(latest.id),
        {
          article: buildArticleTranslationMeta(
            translationResult,
            lang,
          ) as ArticleTranslation,
        },
      ],
    ])
    metaBuilder.translation(translationMap)

    return withMeta(
      {
        ...latestData,
        next: this.toAdjacentNavNote(next),
      },
      metaBuilder.build(),
    )
  }

  @Get('/nid/:nid')
  async getNoteByNid(
    @Param() params: NidType,
    @HasAdminAccess() isAuthenticated: boolean,
    @Query() query: NotePasswordQueryDto,
    @IpLocation() { ip }: IpRecord,
    @Lang() lang?: string,
  ) {
    const { nid } = params
    const current: NoteModel | null = await this.noteService.findByNid(nid)
    if (!current) {
      throw createAppException(AppErrorCode.NOTE_NOT_FOUND)
    }

    if (!isAuthenticated && !current.isPublished) {
      throw createAppException(AppErrorCode.NOTE_NOT_FOUND)
    }

    return this.buildPublicNoteResponse(
      current,
      isAuthenticated,
      query,
      ip,
      lang,
    )
  }

  @Get('/topics/:id')
  async getNotesByTopic(
    @Param() params: EntityIdDto,
    @Query() query: NoteTopicPagerDto,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const { id } = params
    const { size, page, sortBy, sortOrder } = query
    const result = await this.noteService.getNotePaginationByTopicId(
      id,
      {
        page,
        limit: size,
        sortBy: sortBy as any,
        sortOrder: sortOrder === 'asc' ? 1 : -1,
      },
      isAuthenticated ? {} : { isPublished: true },
    )

    if (!isAuthenticated) {
      for (const doc of result.data) {
        doc.location = null
        doc.coordinates = null
      }
    }

    const { results: translationResults, meta: translationMeta } =
      await this.translationService.collectArticleTranslations({
        articles: result.data.map((doc) => ({
          id: String(doc.id),
          title: doc.title,
          text: '',
          createdAt: doc.createdAt,
          modifiedAt: doc.modifiedAt,
        })),
        targetLang: lang,
        fields: ['title'],
      })

    for (const doc of result.data) {
      const tr = translationResults.get(String(doc.id))
      if (tr?.isTranslated && tr.title) {
        doc.title = tr.title
      }
    }

    if (lang) {
      const entryMaps = await this.batchEntryTranslations(lang, result.data)
      for (const doc of result.data) {
        applyTranslationEntriesInPlace(doc, entryMaps, NOTE_ENTRY_RULES)
      }
    }

    const metaBuilder = new MetaObjectBuilder().view('card').pagination({
      page: result.pagination.currentPage,
      size: result.pagination.size,
      total: result.pagination.total,
      totalPages: result.pagination.totalPage,
    })
    if (translationMeta.size > 0) metaBuilder.translation(translationMeta)

    return withMeta(result.data, metaBuilder.build())
  }

  @Get('/topics/:id/recent-update')
  async getTopicRecentUpdate(
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
  ) {
    const ts = await this.noteService.getTopicRecentUpdate(
      params.id,
      isAuthenticated,
    )
    return { ts }
  }

  @Patch('/:id/publish')
  @Auth()
  async setPublishStatus(
    @Param() params: EntityIdDto,
    @Body() body: SetNotePublishStatusDto,
  ) {
    await this.noteService.updateById(params.id, {
      isPublished: body.isPublished,
    })
    return { success: true }
  }
}
