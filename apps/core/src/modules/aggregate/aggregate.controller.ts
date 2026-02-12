import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { omit } from 'es-toolkit/compat'
import { AnalyzeService } from '../analyze/analyze.service'
import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { OwnerService } from '../owner/owner.service'
import { SnippetService } from '../snippet/snippet.service'
import {
  AggregateQueryDto,
  ReadAndLikeCountDocumentType,
  ReadAndLikeCountTypeDto,
  TimelineQueryDto,
  TopQueryDto,
} from './aggregate.schema'
import { AggregateService } from './aggregate.service'

@ApiController('aggregate')
export class AggregateController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configsService: ConfigsService,
    private readonly analyzeService: AnalyzeService,
    private readonly noteService: NoteService,
    private readonly snippetService: SnippetService,
    private readonly ownerService: OwnerService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('/')
  @HttpCache({
    key: CacheKeys.Aggregate,
    ttl: 10 * 60,
    withQuery: true,
  })
  async aggregate(@Query() query: AggregateQueryDto, @Lang() lang?: string) {
    const { theme } = query

    const tasks = await Promise.allSettled([
      this.ownerService.getOwner(),
      this.aggregateService.getAllCategory(),
      this.aggregateService.getAllPages(),
      this.configsService.get('url'),
      this.configsService.get('seo'),
      this.noteService.getLatestNoteId(),
      !theme
        ? Promise.resolve()
        : this.snippetService
            .getCachedSnippet('theme', theme, 'public')
            .then((cached) => {
              if (cached) {
                return JSON.safeParse(cached) || cached
              }
              return this.snippetService.getPublicSnippetByName(theme, 'theme')
            }),
      this.configsService.get('ai'),
    ])
    const [
      user,
      categories,
      pageMeta,
      url,
      seo,
      latestNoteId,
      themeConfig,
      aiConfig,
    ] = tasks.map((t) => (t.status === 'fulfilled' ? t.value : null))
    let translatedPageMeta = pageMeta as any[]
    if (lang && translatedPageMeta?.length) {
      translatedPageMeta = await this.translationService.translateList({
        items: translatedPageMeta,
        targetLang: lang,
        translationFields: ['title'] as const,
        getInput: (item: any) => ({
          id: item._id?.toString?.() ?? '',
          title: item.title ?? '',
        }),
        applyResult: (item: any, translation) => {
          if (!translation?.isTranslated) return item
          return { ...item, title: translation.title }
        },
      })
    }

    return {
      user,
      seo,
      url: omit(url, ['adminUrl']),
      categories,
      pageMeta: translatedPageMeta,
      latestNoteId,
      theme: themeConfig,
      ai: {
        enableSummary: aiConfig?.enableSummary ?? false,
      },
    }
  }

  @Get('/top')
  async top(
    @Query() query: TopQueryDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const { size } = query
    const result = await this.aggregateService.topActivity(
      size,
      isAuthenticated,
    )

    if (lang) {
      type TopItem = {
        _id?: any
        id?: string
        title?: string
        created?: Date | null
        modified?: Date | null
      } & Record<string, any>

      if (result.posts?.length) {
        result.posts = await this.translationService.translateList({
          items: result.posts as TopItem[],
          targetLang: lang,
          translationFields: ['title', 'translationMeta'] as const,
          getInput: (item) => ({
            id: item._id?.toString?.() ?? item.id ?? '',
            title: item.title ?? '',
            created: item.created,
            modified: item.modified,
          }),
          applyResult: (item, translation) => {
            if (!translation?.isTranslated) return item
            return {
              ...item,
              title: translation.title,
              isTranslated: true,
              translationMeta: translation.translationMeta,
            }
          },
        })
      }

      if (result.notes?.length) {
        result.notes = await this.translationService.translateList({
          items: result.notes as TopItem[],
          targetLang: lang,
          translationFields: ['title', 'translationMeta'] as const,
          getInput: (item) => ({
            id: item._id?.toString?.() ?? item.id ?? '',
            title: item.title ?? '',
            created: item.created,
            modified: item.modified,
          }),
          applyResult: (item, translation) => {
            if (!translation?.isTranslated) return item
            return {
              ...item,
              title: translation.title,
              isTranslated: true,
              translationMeta: translation.translationMeta,
            }
          },
        })
      }
    }

    return result
  }

  @Get('/timeline')
  async getTimeline(@Query() query: TimelineQueryDto, @Lang() lang?: string) {
    const { sort = 1, type, year } = query
    const data = await this.aggregateService.getTimeline(year, type, sort)
    type TimelineItem = {
      _id?: { toString?: () => string } | string
      id?: string
      title: string
      created?: Date | null
      modified?: Date | null
    } & Record<string, unknown>

    // 处理 posts 翻译
    if (lang && data.posts?.length) {
      const posts = data.posts as TimelineItem[]
      data.posts = await this.translationService.translateList({
        items: posts,
        targetLang: lang,
        translationFields: ['title', 'translationMeta'] as const,
        getInput: (post) => ({
          id: post._id?.toString?.() ?? post.id ?? String(post._id),
          title: post.title,
          modified: post.modified,
          created: post.created,
        }),
        applyResult: (post, translation) => {
          if (!translation?.isTranslated) return post
          return {
            ...post,
            title: translation.title,
            isTranslated: true,
            translationMeta: translation.translationMeta,
          }
        },
      })
    }

    // 处理 notes 翻译
    if (lang && data.notes?.length) {
      const notes = data.notes as TimelineItem[]
      data.notes = await this.translationService.translateList({
        items: notes,
        targetLang: lang,
        translationFields: ['title', 'translationMeta'] as const,
        getInput: (note) => ({
          id: note._id?.toString?.() ?? note.id ?? String(note._id),
          title: note.title,
          modified: note.modified,
          created: note.created,
        }),
        applyResult: (note, translation) => {
          if (!translation?.isTranslated) return note
          return {
            ...note,
            title: translation.title,
            isTranslated: true,
            translationMeta: translation.translationMeta,
          }
        },
      })
    }

    return { data }
  }

  @Get('/sitemap')
  @CacheKey(CacheKeys.SiteMap)
  @CacheTTL(3600)
  async getSiteMapContent() {
    return { data: await this.aggregateService.getSiteMapContent() }
  }

  @Get('/feed')
  @CacheKey(CacheKeys.RSS)
  @CacheTTL(3600)
  async getRSSFeed() {
    return await this.aggregateService.buildRssStructure()
  }

  @Get('/stat')
  @Auth()
  async stat() {
    const [count, callTime, todayIpAccess] = await Promise.all([
      this.aggregateService.getCounts(),
      this.analyzeService.getCallTime(),
      this.analyzeService.getTodayAccessIp(),
    ])
    return {
      ...count,
      ...callTime,
      todayIpAccessCount: todayIpAccess.length,
    }
  }

  @Get('/count_read_and_like')
  async getAllReadAndLikeCount(@Query() query: ReadAndLikeCountTypeDto) {
    const { type = ReadAndLikeCountDocumentType.All } = query
    return await this.aggregateService.getAllReadAndLikeCount(type)
  }

  @Get('/count_site_words')
  async getSiteWords() {
    return {
      count: await this.aggregateService.getAllSiteWordsCount(),
    }
  }

  @Get('/stat/category-distribution')
  @Auth()
  async getCategoryDistribution() {
    return await this.aggregateService.getCategoryDistribution()
  }

  @Get('/stat/tag-cloud')
  @Auth()
  async getTagCloud() {
    return await this.aggregateService.getTagCloud()
  }

  @Get('/stat/publication-trend')
  @Auth()
  async getPublicationTrend() {
    return await this.aggregateService.getPublicationTrend()
  }

  @Get('/stat/top-articles')
  @Auth()
  async getTopArticles(@Lang() lang?: string) {
    const result = await this.aggregateService.getTopArticles()

    if (lang && result.length) {
      return this.translationService.translateList({
        items: result,
        targetLang: lang,
        translationFields: ['title'] as const,
        getInput: (item) => ({
          id: item.id?.toString?.() ?? '',
          title: item.title ?? '',
        }),
        applyResult: (item, translation) => {
          if (!translation?.isTranslated) return item
          return { ...item, title: translation.title }
        },
      })
    }

    return result
  }

  @Get('/stat/comment-activity')
  @Auth()
  async getCommentActivity() {
    return await this.aggregateService.getCommentActivity()
  }

  @Get('/stat/traffic-source')
  @Auth()
  async getTrafficSource() {
    return await this.aggregateService.getTrafficSource()
  }
}
