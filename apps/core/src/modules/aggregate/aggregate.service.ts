import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { CacheKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import {
  CATEGORY_SERVICE_TOKEN,
  POST_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { RedisService } from '~/processors/redis/redis.service'

import { AnalyzeService } from '../analyze/analyze.service'
import type { CategoryService } from '../category/category.service'
import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { LinkState } from '../link/link.repository'
import { LinkService } from '../link/link.service'
import { NoteService } from '../note/note.service'
import { OwnerService } from '../owner/owner.service'
import { PageService } from '../page/page.service'
import type { PostService } from '../post/post.service'
import { RecentlyService } from '../recently/recently.service'
import { SayService } from '../say/say.service'
import type { RSSProps } from './aggregate.interface'
import { ReadAndLikeCountDocumentType, TimelineType } from './aggregate.schema'

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
    return { notes, posts, says, recently }
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
            new Date(b.created).getTime() - new Date(a.created).getTime(),
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
    const requestedType = type as TimelineType | undefined
    const includePosts =
      requestedType === undefined || requestedType === TimelineType.Post
    const includeNotes =
      requestedType === undefined || requestedType === TimelineType.Note
    const [posts, notes] = await Promise.all([
      includePosts
        ? this.postService.findRecent(100, { publishedOnly: true })
        : [],
      includeNotes
        ? this.noteService.findRecent(100, { visibleOnly: true })
        : [],
    ])
    const filterYear = <T extends { created?: Date }>(items: T[]) =>
      year
        ? items.filter((item) => item.created?.getFullYear() === year)
        : items
    const sort = <T extends { created?: Date }>(items: T[]) =>
      items.sort(
        (a, b) =>
          ((a.created?.getTime() ?? 0) - (b.created?.getTime() ?? 0)) * sortBy,
      )
    return {
      posts: sort(filterYear(posts)),
      notes: sort(filterYear(notes)),
    }
  }

  async getSiteMapContent() {
    const [pages, posts, notes] = await Promise.all([
      this.pageService.findAll(),
      this.postService.findRecent(100, { publishedOnly: true }),
      this.noteService.findRecent(100, { visibleOnly: true }),
    ])
    return [...pages, ...posts, ...notes]
  }

  async buildRssStructure(): Promise<RSSProps> {
    const [owner, seo, latest] = await Promise.all([
      this.ownerService.getOwner(),
      this.configs.get('seo'),
      this.getLatest(20, undefined, true),
    ])
    return {
      title: seo.title || owner.name || 'Mx Space',
      url: '',
      author: owner.name || '',
      description: seo.description || '',
      data: (latest as any[]).map((item) => ({
        created: item.created ?? null,
        modified: item.modified ?? null,
        link: item.slug ?? '',
        title: item.title ?? '',
        text: item.text ?? '',
        id: item.id,
        images: item.images ?? [],
        contentFormat: item.contentFormat,
        content: item.content,
      })),
    } as RSSProps
  }

  async getRSSFeedContent() {
    return this.getLatest(20, undefined, true)
  }

  async getCounts() {
    const [
      posts,
      notes,
      pages,
      comments,
      unreadComments,
      links,
      categories,
      recentlies,
    ] = await Promise.all([
      this.postService.count(),
      this.noteService.count(),
      this.pageService.repository.count(),
      this.commentService.count(),
      this.commentService.countByState(CommentState.Unread),
      this.linkService.countByState(LinkState.Audit),
      this.categoryService.repository.countAll(),
      this.recentlyService.count(),
    ])
    return {
      posts,
      notes,
      pages,
      comments,
      unreadComments,
      links,
      categories,
      recentlies,
    }
  }

  async getAllReadAndLikeCount(type: ReadAndLikeCountDocumentType) {
    void type
    const [posts, notes] = await Promise.all([
      this.postService.findRecent(100),
      this.noteService.findRecent(100),
    ])
    return { posts, notes }
  }

  async getAllSiteWordsCount() {
    const [posts, notes, pages] = await Promise.all([
      this.postService.findRecent(100),
      this.noteService.findRecent(100),
      this.pageService.findAll(),
    ])
    return [...posts, ...notes, ...pages].reduce(
      (sum, item) => sum + (item.text?.length ?? 0),
      0,
    )
  }

  async getSiteInfo() {
    const [counts, owner] = await Promise.all([
      this.getCounts(),
      this.ownerService.getOwner(),
    ])
    return { ...counts, owner }
  }

  async getCategoryDistribution() {
    return this.categoryService.findAllCategory()
  }

  async getTagCloud() {
    return this.postService.aggregateAllTagCounts()
  }

  async getPublicationTrend() {
    const [posts, notes] = await Promise.all([
      this.postService.repository.findArchiveBuckets(),
      this.noteService.repository.findArchiveBuckets(),
    ])
    return { posts, notes }
  }

  async getTopArticles() {
    const posts = await this.postService.findRecent(10, { publishedOnly: true })
    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      read: post.count?.read ?? 0,
      like: post.count?.like ?? 0,
    }))
  }

  async getCommentActivity() {
    return this.commentService.findRecent(30)
  }

  async getTrafficSource() {
    return this.analyzeService.getCallTime().catch(() => ({}))
  }

  @OnEvent(EventBusEvents.CleanAggregateCache)
  async cleanCache() {
    await this.redisService.getClient().del(CacheKeys.Aggregate)
  }
}
