import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { CacheKeys, RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import {
  CATEGORY_SERVICE_TOKEN,
  POST_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { getShortDate } from '~/utils/time.util'

import { AnalyzeService } from '../analyze/analyze.service'
import type { CategoryService } from '../category/category.service'
import { CommentState } from '../comment/comment.enum'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { LinkService } from '../link/link.service'
import { LinkState } from '../link/link.types'
import { NoteService } from '../note/note.service'
import { OwnerService } from '../owner/owner.service'
import { PageService } from '../page/page.service'
import type { PostService } from '../post/post.service'
import { RecentlyService } from '../recently/recently.service'
import { SayService } from '../say/say.service'
import type { RSSProps } from './aggregate.interface'
import { ReadAndLikeCountDocumentType, TimelineType } from './aggregate.schema'

const omitArticleBody = <T extends { text?: unknown; content?: unknown }>(
  row: T,
): Omit<T, 'text' | 'content'> => {
  const { text, content, ...rest } = row
  return rest
}

@Injectable()
export class AggregateService {
  constructor(
    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,
    @Inject(CATEGORY_SERVICE_TOKEN)
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,
    @Inject(forwardRef(() => SayService))
    private readonly sayService: SayService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    @Inject(forwardRef(() => LinkService))
    private readonly linkService: LinkService,
    @Inject(forwardRef(() => RecentlyService))
    private readonly recentlyService: RecentlyService,
    @Inject(forwardRef(() => OwnerService))
    private readonly ownerService: OwnerService,
    private readonly configs: ConfigsService,
    private readonly redisService: RedisService,
    private readonly analyzeService: AnalyzeService,
    private readonly webGateway: WebEventsGateway,
    private readonly urlBuilder: UrlBuilderService,
  ) {}

  getAllCategory() {
    return this.categoryService.findAllCategory()
  }

  getAllPages() {
    return this.pageService.findAll()
  }

  async topActivity(size = 6, isAuthenticated = false) {
    const [notes, posts, says, recently] = await Promise.all([
      this.noteService.findRecent(size, { visibleOnly: !isAuthenticated }),
      this.postService.findRecent(size, { publishedOnly: !isAuthenticated }),
      this.sayService.findRecent(size),
      this.recentlyService.findRecent(size),
    ])
    // The homepage renders only titles/metadata — keep `text`/`content`
    // bodies out of this response or the SSR payload balloons by 100s of KB.
    return {
      notes: notes.map(omitArticleBody),
      posts: posts.map(omitArticleBody),
      says,
      recently,
    }
  }

  async getLatest(limit = 5, types?: TimelineType[], combined = false) {
    const shouldFetchPosts = !types || types.includes(TimelineType.Post)
    const shouldFetchNotes = !types || types.includes(TimelineType.Note)
    const [posts, notes] = await Promise.all([
      shouldFetchPosts
        ? this.postService.findRecent(limit, { publishedOnly: true })
        : undefined,
      shouldFetchNotes
        ? this.noteService.findRecent(limit, { visibleOnly: true })
        : undefined,
    ])
    if (combined) {
      return [
        ...(posts ?? []).map((item) => ({ ...item, type: 'post' })),
        ...(notes ?? []).map((item) => ({ ...item, type: 'note' })),
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, limit)
    }
    return {
      ...(posts ? { posts } : {}),
      ...(notes ? { notes } : {}),
    }
  }

  async getTimeline(
    year: number | undefined,
    type: TimelineType | undefined,
    sortBy: 1 | -1 = 1,
  ) {
    const includePosts = type === undefined || type === TimelineType.Post
    const includeNotes = type === undefined || type === TimelineType.Note
    const sort: 'asc' | 'desc' = sortBy === 1 ? 'asc' : 'desc'
    // Year filter is pushed into SQL — old in-memory filter after a
    // 100-row LIMIT silently dropped older years. See repository
    // `findByYearForTimeline`.
    const [posts, notes] = await Promise.all([
      includePosts
        ? this.postService.repository.findByYearForTimeline({
            year,
            sort,
            publishedOnly: true,
          })
        : [],
      includeNotes
        ? this.noteService.repository.findByYearForTimeline({
            year,
            sort,
            visibleOnly: true,
          })
        : [],
    ])
    return { posts, notes }
  }

  async getSiteMapContent(): Promise<
    Array<{ url: string; published_at: Date | null }>
  > {
    const baseUrl =
      (await this.configs.get('url')).webUrl?.replace(/\/$/, '') ?? ''
    // Full table scans on purpose — sitemaps must be exhaustive.
    const [pages, posts, notes] = await Promise.all([
      this.pageService.findAll(),
      this.postService.repository.findPublishedForSitemap(),
      this.noteService.repository.findVisibleForSitemap(),
    ])
    const pickPublishedAt = (doc: {
      modifiedAt?: Date | null
      createdAt?: Date | null
    }) => doc.modifiedAt ?? doc.createdAt ?? null
    const pageEntries = pages.map((p) => ({
      url: `${baseUrl}/${p.slug}`,
      published_at: pickPublishedAt(p),
    }))
    const postEntries = posts.map((p) => ({
      url: `${baseUrl}/posts/${p.category?.slug ?? 'unknown'}/${p.slug}`,
      published_at: pickPublishedAt(p),
    }))
    const noteEntries = notes.map((n) => ({
      url: `${baseUrl}/notes/${n.nid}`,
      published_at: pickPublishedAt(n),
    }))
    return [...pageEntries, ...postEntries, ...noteEntries].sort((a, b) => {
      const left = a.published_at?.getTime() ?? 0
      const right = b.published_at?.getTime() ?? 0
      return right - left
    })
  }

  async buildRssStructure(): Promise<RSSProps> {
    const [owner, seo, urlConfig, latest] = await Promise.all([
      this.ownerService.getOwner(),
      this.configs.get('seo'),
      this.configs.get('url'),
      this.getLatest(10, undefined, true),
    ])
    const baseURL = urlConfig.webUrl?.replace(/\/$/, '') ?? ''
    const items = latest as Array<Record<string, any>>
    return {
      title: seo.title || owner.name || 'Mx Space',
      url: urlConfig.webUrl ?? '',
      author: owner.name || '',
      description: seo.description || '',
      data: items.map((item) => ({
        created: item.createdAt ?? null,
        modified: item.modifiedAt ?? null,
        link: baseURL + this.urlBuilder.build(item as any),
        title: item.title ?? '',
        text: item.text ?? '',
        id: item.id,
        images: item.images ?? [],
        contentFormat: item.contentFormat,
        content: item.content,
      })),
    }
  }

  async getRSSFeedContent() {
    return this.getLatest(10, undefined, true)
  }

  async getCounts() {
    const redisClient = this.redisService.getClient()
    const dateFormat = getShortDate(new Date())

    const [
      posts,
      notes,
      pages,
      says,
      commentsRootRead,
      commentsRootUnread,
      commentsAllRead,
      commentsAllUnread,
      links,
      linkApply,
      categories,
      recently,
      online,
    ] = await Promise.all([
      this.postService.count(),
      this.noteService.count(),
      this.pageService.repository.count(),
      this.sayService.count(),
      // Root-thread visible counts: parity with old `comments` field which
      // pre-PG filtered `parent: null AND state ∈ {Read, Unread}`. Spam (=2)
      // and deleted rows are excluded by `countByState`.
      this.commentService.countByState(CommentState.Read, true),
      this.commentService.countByState(CommentState.Unread, true),
      // Visible totals (no parent filter): parity with old `allComments`.
      this.commentService.countByState(CommentState.Read),
      this.commentService.countByState(CommentState.Unread),
      // `links` historically counted approved entries; `linkApply` counted
      // pending audit. The PG cutover silently flipped both — restored here.
      this.linkService.countByState(LinkState.Pass),
      this.linkService.countByState(LinkState.Audit),
      this.categoryService.repository.countAll(),
      this.recentlyService.count(),
      this.webGateway.getCurrentClientCount().catch(() => 0),
    ])

    const [todayMaxOnline, todayOnlineTotal] = await Promise.all([
      redisClient.hget(getRedisKey(RedisKeys.MaxOnlineCount), dateFormat),
      redisClient.hget(
        getRedisKey(RedisKeys.MaxOnlineCount, 'total'),
        dateFormat,
      ),
    ])

    return {
      posts,
      notes,
      pages,
      says,
      comments: commentsRootRead + commentsRootUnread,
      allComments: commentsAllRead + commentsAllUnread,
      unreadComments: commentsAllUnread,
      links,
      linkApply,
      categories,
      recently,
      online,
      todayMaxOnline: todayMaxOnline ?? '0',
      todayOnlineTotal: todayOnlineTotal ?? '0',
    }
  }

  async getAllReadAndLikeCount(type: ReadAndLikeCountDocumentType) {
    switch (type) {
      case ReadAndLikeCountDocumentType.Post: {
        return this.postService.repository.aggregateReadAndLikeSums()
      }
      case ReadAndLikeCountDocumentType.Note: {
        return this.noteService.repository.aggregateReadAndLikeSums()
      }
      default: {
        const [postSums, noteSums] = await Promise.all([
          this.postService.repository.aggregateReadAndLikeSums(),
          this.noteService.repository.aggregateReadAndLikeSums(),
        ])
        return {
          totalLikes: postSums.totalLikes + noteSums.totalLikes,
          totalReads: postSums.totalReads + noteSums.totalReads,
        }
      }
    }
  }

  async getAllSiteWordsCount() {
    const [postSum, noteSum, pageSum] = await Promise.all([
      this.postService.repository.sumTextLength(),
      this.noteService.repository.sumTextLength(),
      this.pageService.repository.sumTextLength(),
    ])
    return postSum + noteSum + pageSum
  }

  async getSiteInfo() {
    const [postCount, noteCount, totalWordCount, firstPost, firstNote] =
      await Promise.all([
        this.postService.count(),
        this.noteService.count(),
        this.getAllSiteWordsCount(),
        this.postService.repository.findFirstPublishedAt(),
        this.noteService.repository.findFirstCreatedAtVisible(),
      ])
    let firstPublishDate: Date | null
    if (firstPost && firstNote) {
      firstPublishDate = firstPost < firstNote ? firstPost : firstNote
    } else {
      firstPublishDate = firstPost ?? firstNote ?? null
    }
    return {
      postCount,
      noteCount,
      totalWordCount,
      firstPublishDate: firstPublishDate?.toISOString() ?? null,
    }
  }

  async getCategoryDistribution() {
    const [buckets, categories] = await Promise.all([
      this.postService.repository.aggregatePublishedByCategory(),
      this.categoryService.findAllCategory(),
    ])
    const categoryById = new Map(categories.map((c) => [c.id.toString(), c]))
    return buckets.flatMap((bucket) => {
      const cat = categoryById.get(bucket.categoryId.toString())
      if (!cat) return []
      return [
        {
          id: bucket.categoryId,
          name: cat.name,
          slug: cat.slug,
          count: bucket.count,
        },
      ]
    })
  }

  async getTagCloud() {
    // Old shape was `[{tag, count}]`; SDK / dashboard `TagCloudItem` matches.
    // Repository returns `{name, count}` for shared tag aggregation, so
    // rename the key here.
    const tags = await this.postService.repository.topTagsByCount(20)
    return tags.map((t) => ({ tag: t.name, count: t.count }))
  }

  async getPublicationTrend() {
    const now = new Date()
    const from = new Date(now)
    from.setMonth(from.getMonth() - 12)
    from.setHours(0, 0, 0, 0)
    const [posts, notes] = await Promise.all([
      this.postService.repository.aggregateMonthlyTrend({
        from,
        to: now,
        publishedOnly: true,
      }),
      this.noteService.repository.aggregateMonthlyTrend({
        from,
        to: now,
        visibleOnly: true,
      }),
    ])
    const byDate = new Map<string, { posts: number; notes: number }>()
    for (const item of posts) {
      byDate.set(item.date, { posts: item.count, notes: 0 })
    }
    for (const item of notes) {
      const existing = byDate.get(item.date) ?? { posts: 0, notes: 0 }
      byDate.set(item.date, { ...existing, notes: item.count })
    }
    return [...byDate.entries()]
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async getTopArticles() {
    // Top 10 articles by `read_count desc` — old shape "most-read", not
    // "most-recent". The PG cutover silently swapped the ordering.
    const posts = await this.postService.repository.findTopByReadCount(10)
    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      reads: post.readCount ?? 0,
      likes: post.likeCount ?? 0,
      category: post.category
        ? { name: post.category.name, slug: post.category.slug }
        : null,
    }))
  }

  async getCommentActivity() {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    from.setHours(0, 0, 0, 0)
    return this.commentService.repository.aggregateDailyActivity({
      from,
      to: now,
      states: [CommentState.Read, CommentState.Unread],
    })
  }

  async getTrafficSource() {
    return this.analyzeService.getUaTrafficDistribution()
  }

  @OnEvent(EventBusEvents.CleanAggregateCache)
  async cleanCache() {
    await this.redisService.getClient().del(CacheKeys.Aggregate)
  }
}
