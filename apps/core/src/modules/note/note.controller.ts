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
import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import {
  type ArticleTranslationInput,
  type TranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { applyContentPreference } from '~/utils/content.util'
import { truncateAtBoundary } from '~/utils/text-summary.util'

import { DEFAULT_SUMMARY_LANG } from '../ai/ai.constants'
import { AiInsightsService } from '../ai/ai-insights/ai-insights.service'
import { parseLanguageCode } from '../ai/ai-language.util'
import { AiSummaryService } from '../ai/ai-summary/ai-summary.service'
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
import { NoteModel } from './note.types'

type NoteListItem = NoteModel & {
  isTranslated?: boolean
  translationMeta?: TranslationMeta
}

// Shared @TranslateFields rule sets — kept top-of-file so detail/list endpoints
// stay in sync without copy-paste drift.
const NOTE_LIST_TRANSLATE_FIELDS = [
  { path: 'data[].mood', keyPath: 'note.mood' },
  { path: 'data[].weather', keyPath: 'note.weather' },
  { path: 'data[].topic.name', keyPath: 'topic.name', idField: 'id' },
  {
    path: 'data[].topic.introduce',
    keyPath: 'topic.introduce',
    idField: 'id',
  },
] as const

const NOTE_DETAIL_TRANSLATE_FIELDS = [
  { path: 'mood', keyPath: 'note.mood' },
  { path: 'weather', keyPath: 'note.weather' },
  { path: 'topic.name', keyPath: 'topic.name', idField: 'id' },
  { path: 'topic.introduce', keyPath: 'topic.introduce', idField: 'id' },
  { path: 'data.mood', keyPath: 'note.mood' },
  { path: 'data.weather', keyPath: 'note.weather' },
  { path: 'data.topic.name', keyPath: 'topic.name', idField: 'id' },
  {
    path: 'data.topic.introduce',
    keyPath: 'topic.introduce',
    idField: 'id',
  },
] as const

@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,

    private readonly translationService: TranslationService,
    private readonly aiSummaryService: AiSummaryService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly lexicalService: LexicalService,
  ) {}

  private async buildPublicNoteResponse(
    current: NoteModel,
    isAuthenticated: boolean,
    query: NotePasswordQueryDto,
    ip: string,
    lang?: string,
  ) {
    const { password, single: isSingle, prefer } = query
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
      throw new BizException(ErrorCodeEnum.NoteForbidden)
    }

    const liked = await this.countingService
      .getThisRecordIsLiked(current.id!, ip)
      .catch(() => false)

    const translationResult = await this.translationService.translateArticle({
      articleId: current.id!,
      targetLang: lang,
      allowHidden: Boolean(isAuthenticated || current.password),
      originalData: {
        title: current.title,
        text: current.text,
      },
    })

    // Insights live in their own collection with an independent translation
    // pipeline, so article-translation metadata can't answer "do we have
    // insights in the caller's locale?". Surface a dedicated flag instead.
    const insightsLang = parseLanguageCode(lang)
    const hasInsightsInLocale = await this.aiInsightsService
      .hasInsightsInLang(current.id!, insightsLang)
      .catch(() => false)

    const currentData = {
      ...current,
      title: translationResult.title,
      text: translationResult.text,
      ...(translationResult.content && {
        content: translationResult.content,
        contentFormat: translationResult.contentFormat,
      }),
      isTranslated: translationResult.isTranslated,
      sourceLang: translationResult.sourceLang,
      translationMeta: translationResult.translationMeta,
      availableTranslations: translationResult.availableTranslations,
      hasInsightsInLocale,
      liked,
    }

    if (isSingle) {
      return applyContentPreference(currentData, prefer)
    }

    const [prev] = await this.noteService.findByCreatedWindow(
      current.createdAt!,
      'after',
      1,
      { visibleOnly },
    )
    const [next] = await this.noteService.findByCreatedWindow(
      current.createdAt!,
      'before',
      1,
      { visibleOnly },
    )
    if (!isAuthenticated) {
      for (const adj of [prev, next]) {
        if (!adj) continue
        adj.location = null
        adj.coordinates = null
      }
    }
    await this.translateAdjacentNoteTitles([prev, next], lang)

    return { data: applyContentPreference(currentData, prefer), next, prev }
  }

  private async translateAdjacentNoteTitles(
    notes: Array<NoteListItem | null>,
    lang?: string,
  ) {
    if (!lang) return
    const idMap = new Map<NoteListItem, string>()
    for (const note of notes) {
      if (!note) continue
      idMap.set(note, note.id)
    }
    if (!idMap.size) return

    const titleMap = await this.translationService.getCachedTitles(
      [...idMap.values()],
      lang,
    )

    for (const [note, id] of idMap) {
      const title = titleMap.get(id)
      if (title) note.title = title
    }
  }

  @Get('/')
  @TranslateFields(...NOTE_LIST_TRANSLATE_FIELDS)
  async getNotes(
    @HasAdminAccess() isAuthenticated: boolean,
    @Query() query: NoteQueryDto,
    @Lang() lang?: string,
  ) {
    const { size, select, page, sortBy, sortOrder, year, withSummary } = query

    const result = await this.noteService.listPaginated(page, size, {
      visibleOnly: !isAuthenticated,
      sortBy: sortBy as
        | 'createdAt'
        | 'modifiedAt'
        | 'title'
        | 'mood'
        | 'weather'
        | undefined,
      sortOrder: sortOrder as 1 | -1 | undefined,
      year,
    })

    if (!isAuthenticated) {
      for (const doc of result.data) {
        doc.location = null
        doc.coordinates = null
      }
    }

    if (!result.data.length) {
      return result
    }

    if (withSummary && !lang) {
      await this.enrichDocsWithSummary(result)
      this.applyNoteSelect(result.data, select)
      return result
    }

    if (!lang) {
      this.applyNoteSelect(result.data, select)
      return result
    }

    const translationInputs: ArticleTranslationInput[] = []
    for (const doc of result.data) {
      if (typeof doc.text === 'string') {
        translationInputs.push({
          id: String(doc.id),
          title: doc.title,
          text: doc.text,
          meta: doc.meta as { lang?: string } | undefined,
          contentFormat: doc.contentFormat,
          content: doc.content,
          modifiedAt: doc.modifiedAt,
          createdAt: doc.createdAt,
        })
      }
    }

    if (!translationInputs.length) {
      if (withSummary) {
        await this.enrichDocsWithSummary(result, lang)
      }
      this.applyNoteSelect(result.data, select)
      return result
    }

    const translationResults =
      await this.translationService.translateArticleList({
        articles: translationInputs,
        targetLang: lang,
      })

    result.data = result.data.map((doc) => {
      const docId = String(doc.id)
      const translation = translationResults.get(docId)
      if (!translation?.isTranslated) {
        return doc
      }

      doc.title = translation.title
      doc.text = translation.text
      if (translation.content) {
        doc.content = translation.content
        doc.contentFormat = doc.contentFormat ?? translation.contentFormat
      }
      ;(doc as { isTranslated?: boolean }).isTranslated =
        translation.isTranslated
      ;(doc as { translationMeta?: unknown }).translationMeta =
        translation.translationMeta
      return doc
    })

    // Strip text/content if not originally requested (added only for translation).
    // Cast is required because `delete` on typed required properties needs an
    // index-signature target.
    const originalSelectHasText = select?.includes('text')
    const originalSelectHasContent = select?.includes('content')
    if (!originalSelectHasText || !originalSelectHasContent) {
      for (const doc of result.data) {
        if (!originalSelectHasText && !withSummary) delete (doc as any).text
        if (!originalSelectHasContent) delete (doc as any).content
      }
    }

    if (withSummary) {
      await this.enrichDocsWithSummary(result, lang)
    }

    this.applyNoteSelect(result.data, select)
    return result
  }

  private applyNoteSelect(rows: object[], select: string | undefined): void {
    if (!select) return
    const selected = new Set(
      select
        .split(' ')
        .map((s) => s.trim().replace(/^[+-]/, ''))
        .filter(Boolean),
    )
    // Always preserve `id`, `topic`, and `summary` to keep response shape sound:
    // `id` is the row key, `topic` is a joined value the legacy aggregate
    // pipeline emitted after the `$project` stage, and `summary` is injected
    // by `enrichDocsWithSummary` AFTER select runs — stripping it would erase
    // the very field `?withSummary=1` was sent to populate.
    selected.add('id')
    selected.add('topic')
    selected.add('summary')
    for (let i = 0; i < rows.length; i++) {
      rows[i] = Object.fromEntries(
        Object.entries(rows[i] as Record<string, unknown>).filter(([key]) =>
          selected.has(key),
        ),
      )
    }
  }

  private async enrichDocsWithSummary(
    result: { data: NoteModel[] },
    lang?: string,
  ) {
    const SUMMARY_MAX_LENGTH = 150
    const ids = result.data.map((d) => d.id)
    const summaryMap = await this.aiSummaryService.batchGetSummariesByRefIds(
      ids,
      lang || DEFAULT_SUMMARY_LANG,
    )

    const enriched = result.data.map((doc) => {
      const plain = { ...doc } as Record<string, unknown>
      plain.summary =
        summaryMap.get(doc.id) ??
        this.fallbackSummary(doc, SUMMARY_MAX_LENGTH) ??
        ''
      delete plain.text
      delete plain.content
      return plain
    })

    ;(result as unknown as { data: typeof enriched }).data = enriched
  }

  /**
   * Fallback summary used when the AI cache misses.
   *
   * Truncation is delegated to `truncateAtBoundary` so the teaser never
   * ends mid-word for Latin scripts or mid-sentence for CJK. Locale comes
   * from `meta.lang` when authored that way; otherwise we let
   * `Intl.Segmenter` fall back to its default rules.
   *
   * Lexical notes carry richer structure — the head of `text` (the
   * markdown render of the editor state) often leads with heading hashes,
   * list markers, or block prefixes that look messy in a teaser; pick the
   * first paragraph block from the original editor state instead, which
   * mirrors how a reader would see "the opening" of the note.
   */
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

  @Get(':id')
  @TranslateFields(
    { path: 'mood', keyPath: 'note.mood' },
    { path: 'weather', keyPath: 'note.weather' },
  )
  async getOneNote(
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
  ) {
    const { id } = params

    const current = await this.noteService.findById(id)
    if (!current) {
      throw new CannotFindException()
    }

    // 非认证用户只能查看已发布的手记
    if (!isAuthenticated && !current.isPublished) {
      throw new CannotFindException()
    }

    if (!isAuthenticated) {
      current.location = null
      current.coordinates = null
    }

    return current
  }

  @Get('/:year/:month/:day/:slug')
  @TranslateFields(...NOTE_DETAIL_TRANSLATE_FIELDS)
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
      {
        includeLocation: isAuthenticated,
      },
    )

    if (!current || (!isAuthenticated && !current.isPublished)) {
      throw new CannotFindException()
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

    // 当前文档直接找，不用加条件，反正里面的东西是看不到的
    const currentDocument = await this.noteService.findById(id)

    if (!currentDocument) {
      return { data: [], size: 0 }
    }
    const findAdjacent = (direction: 'prev' | 'next', count: number) => {
      if (count <= 0) return Promise.resolve([])
      return this.noteService.findByCreatedWindow(
        currentDocument.createdAt,
        direction === 'prev' ? 'after' : 'before',
        count,
        { visibleOnly: !isAuthenticated },
      )
    }

    const [prevList, nextList] = await Promise.all([
      findAdjacent('prev', half - 1),
      findAdjacent('next', half ? half - 1 : 0),
    ])
    const merged = [...prevList, ...nextList, currentDocument].sort(
      (a, b) => (b.createdAt?.valueOf() ?? 0) - (a.createdAt?.valueOf() ?? 0),
    )

    // SDK consumer (`NoteTimelineItem`) only reads id/title/nid/slug/createdAt/
    // isPublished plus translation flags, so trim eagerly here — the legacy
    // mongo handler used `select('nid _id title slug created isPublished
    // modified')` for the same reason.
    let data = merged.map((doc) => ({
      id: doc.id,
      title: doc.title,
      nid: doc.nid,
      slug: doc.slug,
      isPublished: doc.isPublished,
      createdAt: doc.createdAt,
    })) as NoteListItem[]

    // 处理翻译
    data = await this.translationService.translateList({
      items: data,
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: String(item.id),
        title: item.title,
        modifiedAt: item.modifiedAt,
        createdAt: item.createdAt,
      }),
      applyResult: (item, translation) => {
        if (translation?.isTranslated) {
          item.title = translation.title
          item.isTranslated = true
          item.translationMeta = translation.translationMeta
        }
        return item
      },
    })

    return { data, size: data.length }
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: NoteDto) {
    return await this.noteService.create(body as unknown as NoteModel)
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
    return
  }

  @Delete(':id')
  @Auth()
  async deleteNote(@Param() params: EntityIdDto) {
    await this.noteService.deleteById(params.id)
  }

  @Get('/latest')
  @TranslateFields(...NOTE_DETAIL_TRANSLATE_FIELDS)
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
      if (next) {
        next.location = null
        next.coordinates = null
      }
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

    const insightsLang = parseLanguageCode(lang)
    const hasInsightsInLocale = await this.aiInsightsService
      .hasInsightsInLang(latest.id!, insightsLang)
      .catch(() => false)

    return {
      data: {
        ...latest,
        title: translationResult.title,
        text: translationResult.text,
        ...(translationResult.content && {
          content: translationResult.content,
          contentFormat: translationResult.contentFormat,
        }),
        isTranslated: translationResult.isTranslated,
        sourceLang: translationResult.sourceLang,
        translationMeta: translationResult.translationMeta,
        availableTranslations: translationResult.availableTranslations,
        hasInsightsInLocale,
      },
      next,
    }
  }

  // C 端入口
  @Get('/nid/:nid')
  @TranslateFields(...NOTE_DETAIL_TRANSLATE_FIELDS)
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
      throw new CannotFindException()
    }

    // Unauthenticated callers must not see unpublished (draft) notes via nid.
    // The PG cutover dropped the `isPublished: true` filter that the mongo
    // version applied to `findOne({ nid, ...condition })`.
    if (!isAuthenticated && !current.isPublished) {
      throw new CannotFindException()
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
  @TranslateFields(
    { path: 'docs[].mood', keyPath: 'note.mood' },
    { path: 'docs[].weather', keyPath: 'note.weather' },
  )
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
        sortBy: sortBy as
          | 'createdAt'
          | 'modifiedAt'
          | 'title'
          | 'mood'
          | 'weather'
          | undefined,
        sortOrder: sortOrder as 1 | -1 | undefined,
      },
      isAuthenticated ? {} : { isPublished: true },
    )

    if (!isAuthenticated) {
      for (const doc of result.data) {
        doc.location = null
        doc.coordinates = null
      }
    }

    // 处理翻译
    const translatedDocs = await this.translationService.translateList({
      items: result.data as unknown as NoteListItem[],
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: String(item.id),
        title: item.title,
        modifiedAt: item.modifiedAt,
        createdAt: item.createdAt,
      }),
      applyResult: (item, translation) => {
        delete (item as { text?: string }).text // 始终移除 text
        if (translation?.isTranslated) {
          item.title = translation.title
          item.isTranslated = true
          item.translationMeta = translation.translationMeta
        }
        return item
      },
    })
    result.data = translatedDocs as typeof result.data

    return result
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
