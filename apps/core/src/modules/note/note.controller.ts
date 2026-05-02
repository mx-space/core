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
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import {
  type ArticleTranslationInput,
  type TranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { applyContentPreference } from '~/utils/content.util'

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

type NoteListItem = {
  _id?: { toString?: () => string } | string
  id?: string
  nid?: number
  title: string
  slug?: string
  created?: Date | null
  modified?: Date | null
  isPublished?: boolean
  isTranslated?: boolean
  translationMeta?: TranslationMeta
}

@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,

    private readonly translationService: TranslationService,
    private readonly aiSummaryService: AiSummaryService,
    private readonly aiInsightsService: AiInsightsService,
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

    current.text =
      !isAuthenticated && this.noteService.checkNoteIsSecret(current)
        ? ''
        : current.text

    if (
      !this.noteService.checkPasswordToAccess(current, password) &&
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
      current.created!,
      'after',
      1,
      { visibleOnly },
    )
    const [next] = await this.noteService.findByCreatedWindow(
      current.created!,
      'before',
      1,
      { visibleOnly },
    )
    if (currentData.password) {
      currentData.password = '*'
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
      const id =
        typeof note._id === 'string'
          ? note._id
          : (note._id?.toString?.() ?? note.id ?? '')
      if (id) idMap.set(note, id)
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
  @Paginator
  @TranslateFields(
    { path: 'docs[].mood', keyPath: 'note.mood' },
    { path: 'docs[].weather', keyPath: 'note.weather' },
    { path: 'docs[].topic.name', keyPath: 'topic.name', idField: '_id' },
    {
      path: 'docs[].topic.introduce',
      keyPath: 'topic.introduce',
      idField: '_id',
    },
  )
  async getNotes(
    @HasAdminAccess() isAuthenticated: boolean,
    @Query() query: NoteQueryDto,
    @Lang() lang?: string,
  ) {
    const {
      size,
      select,
      page,
      sortBy,
      sortOrder,
      year,
      db_query,
      withSummary,
    } = query
    void year
    void db_query

    // When withSummary or lang, ensure text is fetched for translation + fallback, will be stripped later
    let paginateSelect = isAuthenticated
      ? select
      : select?.replaceAll(/[+-]?(coordinates|location|password)/g, '')
    if (
      (withSummary || lang) &&
      paginateSelect &&
      !paginateSelect.includes('text')
    ) {
      paginateSelect = `${paginateSelect} text`
    }

    void paginateSelect
    void sortBy
    void sortOrder
    const result = await this.noteService.listPaginated(page, size, {
      visibleOnly: !isAuthenticated,
    })

    if (!result.docs.length) {
      return result
    }

    if (withSummary && !lang) {
      await this.enrichDocsWithSummary(result)
      return result
    }

    if (!lang) {
      return result
    }

    const translationInputs: ArticleTranslationInput[] = []
    for (const doc of result.docs) {
      if (doc.meta && typeof doc.meta === 'string') {
        doc.meta = JSON.safeParse(doc.meta as string) || doc.meta
      }

      if (typeof doc.text === 'string') {
        translationInputs.push({
          id: doc._id?.toString?.() ?? doc.id ?? String(doc._id),
          title: doc.title,
          text: doc.text,
          meta: doc.meta as { lang?: string } | undefined,
          contentFormat: doc.contentFormat,
          content: doc.content,
          modified: doc.modified,
          created: doc.created,
        })
      }
    }

    if (!translationInputs.length) {
      if (withSummary) {
        await this.enrichDocsWithSummary(result, lang)
      }
      return result
    }

    const translationResults =
      await this.translationService.translateArticleList({
        articles: translationInputs,
        targetLang: lang,
      })

    result.docs = result.docs.map((doc) => {
      const docId = doc._id?.toString?.() ?? doc.id ?? String(doc._id)
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

    // Strip text/content if not originally requested (added only for translation)
    const originalSelectHasText = select?.includes('text')
    const originalSelectHasContent = select?.includes('content')
    if (!originalSelectHasText || !originalSelectHasContent) {
      for (const doc of result.docs) {
        if (!originalSelectHasText && !withSummary) delete (doc as any).text
        if (!originalSelectHasContent) delete (doc as any).content
      }
    }

    if (withSummary) {
      await this.enrichDocsWithSummary(result, lang)
    }

    return result
  }

  private async enrichDocsWithSummary(
    result: {
      docs: (NoteModel & {
        _id?: { toString: () => string }
        toObject?: () => Record<string, unknown>
      })[]
    },
    lang?: string,
  ) {
    const ids = result.docs.map((d) => d.id || d._id!.toString())
    const summaryMap = await this.aiSummaryService.batchGetSummariesByRefIds(
      ids,
      lang || DEFAULT_SUMMARY_LANG,
    )

    const enriched = result.docs.map((doc) => {
      const plain = (
        typeof doc.toObject === 'function' ? doc.toObject() : doc
      ) as Record<string, unknown>
      const docId =
        (plain.id as string) ||
        (plain._id as { toString: () => string })?.toString()
      plain.summary =
        summaryMap.get(docId) ?? (plain.text as string)?.slice(0, 150) ?? ''
      delete plain.text
      delete plain.content
      return plain
    })

    ;(result as unknown as { docs: typeof enriched }).docs = enriched
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

    return current
  }

  @Get('/:year/:month/:day/:slug')
  @TranslateFields(
    { path: 'mood', keyPath: 'note.mood' },
    { path: 'weather', keyPath: 'note.weather' },
    { path: 'topic.name', keyPath: 'topic.name', idField: '_id' },
    { path: 'topic.introduce', keyPath: 'topic.introduce', idField: '_id' },
    { path: 'data.mood', keyPath: 'note.mood' },
    { path: 'data.weather', keyPath: 'note.weather' },
    { path: 'data.topic.name', keyPath: 'topic.name', idField: '_id' },
    {
      path: 'data.topic.introduce',
      keyPath: 'topic.introduce',
      idField: '_id',
    },
  )
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
    void isAuthenticated

    // 当前文档直接找，不用加条件，反正里面的东西是看不到的
    const currentDocument = await this.noteService.findById(id)

    if (!currentDocument) {
      return { data: [], size: 0 }
    }
    const prevList =
      half - 1 === 0
        ? []
        : await this.noteService.findByCreatedWindow(
            currentDocument.created,
            'after',
            half - 1,
            { visibleOnly: !isAuthenticated },
          )
    const nextList = !half
      ? []
      : await this.noteService.findByCreatedWindow(
          currentDocument.created,
          'before',
          half - 1,
          { visibleOnly: !isAuthenticated },
        )
    let data = [...prevList, ...nextList, currentDocument] as NoteListItem[]
    data = data.sort(
      (a, b) => (b.created?.valueOf() ?? 0) - (a.created?.valueOf() ?? 0),
    )

    // 处理翻译
    data = await this.translationService.translateList({
      items: data,
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: item._id?.toString?.() ?? item.id ?? String(item._id),
        title: item.title,
        modified: item.modified,
        created: item.created,
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
  @TranslateFields(
    { path: 'mood', keyPath: 'note.mood' },
    { path: 'weather', keyPath: 'note.weather' },
    { path: 'topic.name', keyPath: 'topic.name', idField: '_id' },
    { path: 'topic.introduce', keyPath: 'topic.introduce', idField: '_id' },
    { path: 'data.mood', keyPath: 'note.mood' },
    { path: 'data.weather', keyPath: 'note.weather' },
    { path: 'data.topic.name', keyPath: 'topic.name', idField: '_id' },
    {
      path: 'data.topic.introduce',
      keyPath: 'topic.introduce',
      idField: '_id',
    },
  )
  async getLatestOne(
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const result = await this.noteService.getLatestOne(
      isAuthenticated ? {} : this.noteService.publicNoteQueryCondition,
      isAuthenticated ? '+location +coordinates' : '-location -coordinates',
    )

    if (!result) return null
    const { latest, next } = result
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
  @TranslateFields(
    { path: 'mood', keyPath: 'note.mood' },
    { path: 'weather', keyPath: 'note.weather' },
    { path: 'topic.name', keyPath: 'topic.name', idField: '_id' },
    { path: 'topic.introduce', keyPath: 'topic.introduce', idField: '_id' },
    { path: 'data.mood', keyPath: 'note.mood' },
    { path: 'data.weather', keyPath: 'note.weather' },
    { path: 'data.topic.name', keyPath: 'topic.name', idField: '_id' },
    {
      path: 'data.topic.introduce',
      keyPath: 'topic.introduce',
      idField: '_id',
    },
  )
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

    return this.buildPublicNoteResponse(
      current,
      isAuthenticated,
      query,
      ip,
      lang,
    )
  }

  @Get('/topics/:id')
  @HTTPDecorators.Paginator
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
    const {
      size,
      page,
      select = '_id title nid id created modified text',
      sortBy,
      sortOrder,
    } = query
    void select
    void sortBy
    void sortOrder
    const result = await this.noteService.getNotePaginationByTopicId(
      id,
      {
        page,
        limit: size,
      },
      isAuthenticated ? {} : { isPublished: true },
    )

    // 处理翻译
    const translatedDocs = await this.translationService.translateList({
      items: result.docs as unknown as NoteListItem[],
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: item._id?.toString?.() ?? item.id ?? String(item._id),
        title: item.title,
        modified: item.modified,
        created: item.created,
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
    result.docs = translatedDocs as typeof result.docs

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
