import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { merge, omit } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { CacheKeys } from '~/constants/cache.constant'
import {
  applyArticleTranslationInPlace,
  applyTranslationEntriesInPlace,
  TranslationService,
} from '~/processors/helper/helper.translation.service'

import { TranslationEntryService } from '../ai/ai-translation/translation-entry.service'
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
import { resolveSeo } from './resolve-seo.util'

type TitledItem = {
  id: string
  title: string
  createdAt: Date
  modifiedAt: Date | null
} & Record<string, any>

const NOTE_DICT_RULES = [
  { path: 'mood', keyPath: 'note.mood' as const, mode: 'dict' as const },
  { path: 'weather', keyPath: 'note.weather' as const, mode: 'dict' as const },
]

const CATEGORY_NAME_RULES = [
  {
    path: 'category.name',
    keyPath: 'category.name' as const,
    mode: 'entity' as const,
    idField: 'id',
  },
]

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
    private readonly translationEntryService: TranslationEntryService,
  ) {}

  private async getThemeConfig(theme?: string, lang?: string) {
    if (!theme) return
    const candidates = theme
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const candidate of candidates) {
      const baseConfig = await this.getSnippetData(`theme/${candidate}`)
      if (!baseConfig) continue
      if (!lang) return baseConfig
      const langOverlay = await this.getSnippetData(
        `theme/${candidate}.${lang}`,
      )
      if (
        !langOverlay ||
        typeof baseConfig !== 'object' ||
        typeof langOverlay !== 'object'
      ) {
        return baseConfig
      }
      return merge({}, baseConfig, langOverlay)
    }
    return
  }

  private async translateTitledItems(options: {
    lang: string
    allItems: TitledItem[]
    notes: TitledItem[]
    categoryPosts?: TitledItem[]
  }) {
    const { lang, allItems, notes, categoryPosts = [] } = options
    const categoryIds = categoryPosts
      .map((p) => p.category?.id)
      .filter((id): id is string => id != null)
      .map(String)

    const [{ results: translationResults, meta: translationMeta }, entryMaps] =
      await Promise.all([
        this.translationService.collectArticleTranslations({
          articles: allItems.map((item) => ({
            id: String(item.id),
            title: item.title ?? '',
            text: '',
            createdAt: item.createdAt,
            modifiedAt: item.modifiedAt,
          })),
          targetLang: lang,
          fields: ['title'],
        }),
        this.translationEntryService.getTranslationsBatch(lang, {
          dictLookups: [
            {
              keyPath: 'note.mood',
              sourceTexts: notes
                .map((n) => n.mood)
                .filter((v): v is string => v != null),
            },
            {
              keyPath: 'note.weather',
              sourceTexts: notes
                .map((n) => n.weather)
                .filter((v): v is string => v != null),
            },
          ],
          entityLookups: [
            {
              keyPath: 'category.name',
              lookupKeys: [...new Set(categoryIds)],
            },
          ],
        }),
      ])

    for (const item of allItems) {
      const r = translationResults.get(String(item.id))
      if (r) {
        applyArticleTranslationInPlace(item as Record<string, any>, r as any, {
          fields: ['title'],
        })
      }
    }

    for (const note of notes) {
      applyTranslationEntriesInPlace(
        note as Record<string, any>,
        entryMaps,
        NOTE_DICT_RULES,
      )
    }

    for (const post of categoryPosts) {
      applyTranslationEntriesInPlace(
        post as Record<string, any>,
        entryMaps,
        CATEGORY_NAME_RULES,
      )
    }

    return translationMeta
  }

  private async getSnippetData(path: string) {
    const cached = await this.snippetService.getCachedSnippetByPath(
      path,
      'public',
    )
    if (cached) {
      return JSON.safeParse(cached) || cached
    }
    try {
      return await this.snippetService.getPublicSnippetByPath(path)
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
      seo: resolveSeo(seo, lang),
      url: url ? omit(url, ['adminUrl']) : url,
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
  async site(@Lang() lang?: string) {
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
      seo: resolveSeo(seo, lang),
      url: { webUrl: url.webUrl },
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

    const notes = (result.notes ?? []) as TitledItem[]
    const posts = (result.posts ?? []) as TitledItem[]
    const allItems = [...posts, ...notes]

    const translationMeta = await this.translateTitledItems({
      lang,
      allItems,
      notes,
    })

    if (translationMeta.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(translationMeta).build(),
    )
  }

  @Get('/latest')
  async getLatest(@Query() query: LatestQueryDto, @Lang() lang?: string) {
    const { limit = 5, types, combined = false } = query
    const result = await this.aggregateService.getLatest(limit, types, combined)

    if (!lang) return result

    const isCombined = combined === true
    const notes: TitledItem[] = isCombined
      ? (result as TitledItem[]).filter((i) => i.type === 'note')
      : (((result as Record<string, any>).notes ?? []) as TitledItem[])
    const allItems: TitledItem[] = isCombined
      ? (result as TitledItem[])
      : [
          ...(((result as Record<string, any>).posts ?? []) as TitledItem[]),
          ...notes,
        ]

    const translationMeta = await this.translateTitledItems({
      lang,
      allItems,
      notes,
    })

    if (translationMeta.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(translationMeta).build(),
    )
  }

  @Get('/timeline')
  async getTimeline(@Query() query: TimelineQueryDto, @Lang() lang?: string) {
    const { sort = 1, type, year } = query
    const data = await this.aggregateService.getTimeline(year, type, sort)

    if (!lang) return data

    const notes = (data.notes ?? []) as TitledItem[]
    const posts = (data.posts ?? []) as TitledItem[]
    const allItems = [...posts, ...notes]

    const translationMeta = await this.translateTitledItems({
      lang,
      allItems,
      notes,
      categoryPosts: posts,
    })

    if (translationMeta.size === 0) return data

    return withMeta(
      data,
      new MetaObjectBuilder().translation(translationMeta).build(),
    )
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
    return { count: await this.aggregateService.getAllSiteWordsCount() }
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

    if (!lang || !result.length) return result

    const { results: translationResults, meta: translationMeta } =
      await this.translationService.collectArticleTranslations({
        articles: result.map((item) => ({
          id: String(item.id),
          title: item.title ?? '',
          text: '',
          createdAt: new Date(),
          modifiedAt: null,
        })),
        targetLang: lang,
        fields: ['title'],
      })

    for (const item of result) {
      const r = translationResults.get(String(item.id))
      if (r) {
        applyArticleTranslationInPlace(item as Record<string, any>, r as any, {
          fields: ['title'],
        })
      }
    }

    if (translationMeta.size === 0) return result

    return withMeta(
      result,
      new MetaObjectBuilder().translation(translationMeta).build(),
    )
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
