import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { TranslationEnhancerService } from '~/processors/helper/helper.translation-enhancer.service'
import { omit } from 'es-toolkit/compat'
import { AnalyzeService } from '../analyze/analyze.service'
import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { SnippetService } from '../snippet/snippet.service'
import { UserService } from '../user/user.service'
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
    private readonly userService: UserService,
    private readonly translationEnhancerService: TranslationEnhancerService,
  ) {}

  @Get('/')
  @HttpCache({
    key: CacheKeys.Aggregate,
    ttl: 10 * 60,
    withQuery: true,
  })
  async aggregate(@Query() query: AggregateQueryDto) {
    const { theme } = query

    const tasks = await Promise.allSettled([
      this.userService.getMaster(),
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
    ] = tasks.map((t) => {
      if (t.status === 'fulfilled') {
        return t.value
      } else {
        return null
      }
    })
    return {
      user,
      seo,
      url: omit(url, ['adminUrl']),
      categories,
      pageMeta,
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
  ) {
    const { size } = query
    return await this.aggregateService.topActivity(size, isAuthenticated)
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
      data.posts = await this.translationEnhancerService.translateList({
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
      data.notes = await this.translationEnhancerService.translateList({
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
  async getTopArticles() {
    return await this.aggregateService.getTopArticles()
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
