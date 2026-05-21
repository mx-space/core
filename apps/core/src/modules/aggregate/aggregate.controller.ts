import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { merge, omit } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { withMeta } from '~/common/response/envelope.types'
import type { EntryTranslation } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
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

type TitledItem = {
  id: string
  title: string
  createdAt: Date
  modifiedAt: Date | null
} & Record<string, any>

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

  private async getThemeConfig(theme?: string, lang?: string) {
    if (!theme) return
    const baseConfig = await this.getSnippetData('theme', theme)
    if (!baseConfig) return
    if (!lang) return baseConfig
    const langOverlay = await this.getSnippetData('theme', `${theme}.${lang}`)
    if (
      !langOverlay ||
      typeof baseConfig !== 'object' ||
      typeof langOverlay !== 'object'
    ) {
      return baseConfig
    }
    return merge({}, baseConfig, langOverlay)
  }

  private async getSnippetData(reference: string, name: string) {
    const cached = await this.snippetService.getCachedSnippet(
      reference,
      name,
      'public',
    )
    if (cached) {
      return JSON.safeParse(cached) || cached
    }
    try {
      return await this.snippetService.getPublicSnippetByName(name, reference)
    } catch {
      return null
    }
  }

  @Get('/')
  @HttpCache({
    key: CacheKeys.Aggregate,
    ttl: 10 * 60,
    withQuery: true,
  })
  async aggregate(@Query() query: AggregateQueryDto, @Lang() lang?: string) {
    const { theme } = query

    const [
      user,
      url,
      seo,
      commentOptions,
      latestNoteId,
      themeConfig,
      aiConfig,
    ] = await Promise.all([
      this.ownerService.getOwner(),
      this.configsService.get('url'),
      this.configsService.get('seo'),
      this.configsService.get('commentOptions'),
      this.noteService.getLatestNoteId(),
      this.getThemeConfig(theme, lang),
      this.configsService.get('ai'),
    ])

    return {
      user,
      seo,
      url: url ? omit(url, ['adminUrl']) : url,
      comment_options: commentOptions
        ? {
            disable_comment: commentOptions.disableComment ?? false,
            allow_guest_comment: commentOptions.allowGuestComment ?? true,
          }
        : undefined,
      latest_note_id: latestNoteId,
      theme: themeConfig,
      ai: {
        enable_summary: aiConfig?.enableSummary ?? false,
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
        social_ids: user.socialIds,
      },
      seo,
      url: { web_url: url.webUrl },
    }
  }

  @Get('/top')
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

    if (!lang) return result

    const translationMap = await this.buildTitleTranslationMap(
      [
        ...((result.posts ?? []) as TitledItem[]),
        ...((result.notes ?? []) as TitledItem[]),
      ],
      lang,
    )
    if (translationMap.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(translationMap).build(),
    )
  }

  @Get('/latest')
  async getLatest(@Query() query: LatestQueryDto, @Lang() lang?: string) {
    const { limit = 5, types, combined = false } = query
    const result = await this.aggregateService.getLatest(limit, types, combined)

    if (!lang) return result

    const items: TitledItem[] = combined
      ? (result as TitledItem[])
      : [
          ...(((result as Record<string, any>).posts ?? []) as TitledItem[]),
          ...(((result as Record<string, any>).notes ?? []) as TitledItem[]),
        ]
    const translationMap = await this.buildTitleTranslationMap(items, lang)
    if (translationMap.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(translationMap).build(),
    )
  }

  @Get('/timeline')
  async getTimeline(@Query() query: TimelineQueryDto, @Lang() lang?: string) {
    const { sort = 1, type, year } = query
    const data = await this.aggregateService.getTimeline(year, type, sort)

    if (!lang) return data

    const translationMap = await this.buildTitleTranslationMap(
      [
        ...((data.posts ?? []) as unknown as TitledItem[]),
        ...((data.notes ?? []) as unknown as TitledItem[]),
      ],
      lang,
    )
    if (translationMap.size === 0) return data

    return withMeta(
      data,
      new MetaObjectBuilder().translation(translationMap).build(),
    )
  }

  private async buildTitleTranslationMap(
    items: TitledItem[],
    targetLang: string,
  ): Promise<Map<string, EntryTranslation>> {
    const map = new Map<string, EntryTranslation>()
    if (!items.length) return map

    const results = await this.translationService.translateArticleList({
      articles: items.map((item) => ({
        id: String(item.id),
        title: item.title ?? '',
        text: '',
        createdAt: item.createdAt,
        modifiedAt: item.modifiedAt,
      })),
      targetLang,
      translationFields: ['title'] as const,
    })

    for (const [id, translation] of results) {
      if (translation?.isTranslated) {
        map.set(id, {
          article: {
            isTranslated: true,
            targetLang,
            title: translation.title,
          },
        })
      }
    }
    return map
  }

  @Get('/sitemap')
  @CacheKey(CacheKeys.SiteMap)
  @CacheTTL(3600)
  async getSiteMapContent() {
    return await this.aggregateService.getSiteMapContent()
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
    const c = count as Record<string, any>
    const ct = callTime as Record<string, any>
    return {
      posts: c.posts,
      notes: c.notes,
      pages: c.pages,
      says: c.says,
      comments: c.comments,
      all_comments: c.allComments ?? c.all_comments,
      unread_comments: c.unreadComments ?? c.unread_comments,
      links: c.links,
      link_apply: c.linkApply ?? c.link_apply,
      categories: c.categories,
      recently: c.recently,
      online: c.online,
      today_max_online: c.todayMaxOnline ?? c.today_max_online,
      today_online_total: c.todayOnlineTotal ?? c.today_online_total,
      call_time: ct.callTime ?? ct.call_time,
      uv: ct.uv,
      today_ip_access_count: todayIpAccess.length,
    }
  }

  @Get('/count_read_and_like')
  async getAllReadAndLikeCount(@Query() query: ReadAndLikeCountTypeDto) {
    const { type = ReadAndLikeCountDocumentType.All } = query
    const result = await this.aggregateService.getAllReadAndLikeCount(type)
    return {
      total_likes: (result as any).totalLikes ?? (result as any).total_likes,
      total_reads: (result as any).totalReads ?? (result as any).total_reads,
    }
  }

  @Get('/count_site_words')
  async getSiteWords() {
    return { count: await this.aggregateService.getAllSiteWordsCount() }
  }

  @Get('/site_info')
  async getSiteInfo() {
    const info = await this.aggregateService.getSiteInfo()
    return {
      post_count: (info as any).postCount ?? (info as any).post_count,
      note_count: (info as any).noteCount ?? (info as any).note_count,
      total_word_count:
        (info as any).totalWordCount ?? (info as any).total_word_count,
      first_publish_date:
        (info as any).firstPublishDate ?? (info as any).first_publish_date,
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
      const translated = await this.translationService.translateList({
        items: result as Array<Record<string, any>>,
        targetLang: lang,
        translationFields: ['title'] as const,
        getInput: (item) => ({
          id: item.id,
          title: item.title ?? '',
        }),
        applyResult: (item, translation) => {
          if (!translation?.isTranslated) return item
          return { ...item, title: translation.title }
        },
      })
      return translated
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
