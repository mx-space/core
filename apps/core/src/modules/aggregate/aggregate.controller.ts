import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { omit } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { TranslationService } from '~/processors/helper/helper.translation.service'

import { AnalyzeService } from '../analyze/analyze.service'
import { ConfigsService } from '../configs/configs.service'
import { NoteService } from '../note/note.service'
import { OwnerService } from '../owner/owner.service'
import { SnippetService } from '../snippet/snippet.service'
import {
  AggregateQueryDto,
  LatestQueryDto,
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

  private async getThemeConfig(theme?: string) {
    if (!theme) {
      return
    }

    const cached = await this.snippetService.getCachedSnippet(
      'theme',
      theme,
      'public',
    )
    if (cached) {
      return JSON.safeParse(cached) || cached
    }
    return this.snippetService.getPublicSnippetByName(theme, 'theme')
  }

  @Get('/')
  @HttpCache({
    key: CacheKeys.Aggregate,
    ttl: 10 * 60,
    withQuery: true,
  })
  async aggregate(@Query() query: AggregateQueryDto) {
    const { theme } = query

    const tasks = await Promise.allSettled([
      this.ownerService.getOwner(),
      this.configsService.get('url'),
      this.configsService.get('seo'),
      this.configsService.get('commentOptions'),
      this.noteService.getLatestNoteId(),
      this.getThemeConfig(theme),
      this.configsService.get('ai'),
    ])
    const [
      user,
      url,
      seo,
      commentOptions,
      latestNoteId,
      themeConfig,
      aiConfig,
    ] = tasks.map((t) => (t.status === 'fulfilled' ? t.value : null))

    return {
      user,
      seo,
      url: omit(url, ['adminUrl']),
      commentOptions: commentOptions
        ? {
            disableComment: commentOptions.disableComment ?? false,
            allowGuestComment: commentOptions.allowGuestComment ?? true,
          }
        : undefined,
      latestNoteId,
      theme: themeConfig,
      ai: {
        enableSummary: aiConfig?.enableSummary ?? false,
      },
    }
  }

  @Get('/site')
  @HttpCache({
    key: CacheKeys.AggregateSite,
    ttl: 10 * 60,
    withQuery: true,
  })
  async site() {
    const [user, url, seo] = await Promise.all([
      this.ownerService.getOwner(),
      this.configsService.get('url'),
      this.configsService.get('seo'),
    ])

    return {
      user: {
        id: user.id,
        name: user.name,
        socialIds: user.socialIds,
      },
      seo,
      url: {
        webUrl: url.webUrl,
      },
    }
  }

  @Get('/top')
  @TranslateFields(
    { path: 'notes[].mood', keyPath: 'note.mood' },
    { path: 'notes[].weather', keyPath: 'note.weather' },
  )
  async top(
    @Query() query: TopQueryDto,
    @HasAdminAccess() isAuthenticated: boolean,
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

  @Get('/latest')
  @TranslateFields(
    { path: 'notes[].mood', keyPath: 'note.mood' },
    { path: 'notes[].weather', keyPath: 'note.weather' },
    { path: 'data[].mood', keyPath: 'note.mood' },
    { path: 'data[].weather', keyPath: 'note.weather' },
  )
  async getLatest(@Query() query: LatestQueryDto, @Lang() lang?: string) {
    const { limit = 5, types, combined = false } = query
    const result = await this.aggregateService.getLatest(limit, types, combined)

    if (!lang) return result

    type LatestItem = {
      _id?: any
      id?: string
      title?: string
      created?: Date | null
      modified?: Date | null
    } & Record<string, any>

    const translateItems = (items: LatestItem[]) =>
      this.translationService.translateList({
        items,
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

    if (combined) {
      return translateItems(result as LatestItem[])
    }

    const data = result as Record<string, any>
    if (data.posts?.length) {
      data.posts = await translateItems(data.posts)
    }
    if (data.notes?.length) {
      data.notes = await translateItems(data.notes)
    }
    return data
  }

  @Get('/timeline')
  @TranslateFields(
    { path: 'data.notes[].mood', keyPath: 'note.mood' },
    { path: 'data.notes[].weather', keyPath: 'note.weather' },
    {
      path: 'data.posts[].category.name',
      keyPath: 'category.name',
      idField: 'id',
    },
  )
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

  @Get('/site_info')
  async getSiteInfo() {
    return await this.aggregateService.getSiteInfo()
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
