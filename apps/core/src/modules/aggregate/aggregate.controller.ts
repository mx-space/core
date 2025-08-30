import { CacheKey, CacheTTL } from '@nestjs/cache-manager'
import { Get, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HttpCache } from '~/common/decorators/cache.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CacheKeys } from '~/constants/cache.constant'
import { omit } from 'lodash'
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
} from './aggregate.dto'
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
    ])
    const [user, categories, pageMeta, url, seo, latestNoteId, themeConfig] =
      tasks.map((t) => {
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
  async getTimeline(@Query() query: TimelineQueryDto) {
    const { sort = 1, type, year } = query
    return { data: await this.aggregateService.getTimeline(year, type, sort) }
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
      length: await this.aggregateService.getAllSiteWordsCount(),
    }
  }
}
