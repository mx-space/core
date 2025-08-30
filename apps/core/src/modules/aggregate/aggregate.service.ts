import { URL } from 'node:url'
import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { ReturnModelType } from '@typegoose/typegoose'
import type { AnyParamConstructor } from '@typegoose/typegoose/lib/types'
import {
  API_CACHE_PREFIX,
  CacheKeys,
  RedisKeys,
} from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { RedisService } from '~/processors/redis/redis.service'
import { addYearCondition } from '~/transformers/db-query.transformer'
import { getRedisKey } from '~/utils/redis.util'
import { getShortDate } from '~/utils/time.util'
import { pick } from 'lodash'
import type { PipelineStage } from 'mongoose'
import type { CategoryModel } from '../category/category.model'
import { CategoryService } from '../category/category.service'
import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { LinkState } from '../link/link.model'
import { LinkService } from '../link/link.service'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { RecentlyService } from '../recently/recently.service'
import { SayService } from '../say/say.service'
import { UserService } from '../user/user.service'
import { ReadAndLikeCountDocumentType, TimelineType } from './aggregate.dto'
import type { RSSProps } from './aggregate.interface'

@Injectable()
export class AggregateService {
  constructor(
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(forwardRef(() => CategoryService))
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

    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly urlService: UrlBuilderService,

    private readonly configs: ConfigsService,
    private readonly gateway: WebEventsGateway,
    private readonly redisService: RedisService,
  ) {}

  getAllCategory() {
    return this.categoryService.findAllCategory()
  }

  getAllPages() {
    return this.pageService.model
      .find({}, 'title _id slug order')
      .sort({
        order: -1,
        modified: -1,
      })
      .lean()
  }

  private findTop<
    U extends AnyParamConstructor<any>,
    T extends ReturnModelType<U>,
  >(model: T, condition = {}, size = 6) {
    return model
      .find(condition)
      .sort({ created: -1 })
      .limit(size)
      .select(
        '_id title name slug avatar nid created meta images tags modified',
      )
  }

  async topActivity(size = 6, isAuthenticated = false) {
    const [notes, posts, says, recently] = await Promise.all([
      this.findTop(
        this.noteService.model,
        !isAuthenticated
          ? {
              isPublished: true,
              password: undefined,
            }
          : {},
        size,
      ).lean({ getters: true }),

      this.findTop(
        this.postService.model,
        !isAuthenticated ? { isPublished: true } : {},
        size,
      )
        .populate('categoryId')
        .lean({ getters: true })
        .then((res) => {
          return res.map((post) => {
            post.category = pick(post.categoryId, ['name', 'slug'])
            delete post.categoryId
            return post
          })
        }),

      this.sayService.model.find({}).sort({ create: -1 }).limit(size),
      this.recentlyService.model.find({}).sort({ create: -1 }).limit(size),
    ])

    return { notes, posts, says, recently }
  }

  async getTimeline(
    year: number | undefined,
    type: TimelineType | undefined,
    sortBy: 1 | -1 = 1,
  ) {
    const data: any = {}
    const getPosts = () =>
      this.postService.model
        .find({ ...addYearCondition(year) })
        .sort({ created: sortBy })
        .populate('category')

        .then((list) =>
          list.map((item) => ({
            ...pick(item, ['_id', 'title', 'slug', 'created', 'modified']),
            category: item.category,
            // summary:
            //   item.summary ??
            //   (item.text.length > 150
            //     ? item.text.slice(0, 150) + '...'
            //     : item.text),
            url: encodeURI(
              `/posts/${(item.category as CategoryModel).slug}/${item.slug}`,
            ),
          })),
        )

    const getNotes = () =>
      this.noteService.model
        .find(
          {
            isPublished: true,
            ...addYearCondition(year),
          },
          '_id nid title weather mood created modified bookmark',
        )
        .sort({ created: sortBy })
        .lean()

    switch (type) {
      case TimelineType.Post: {
        data.posts = await getPosts()
        break
      }
      case TimelineType.Note: {
        data.notes = await getNotes()
        break
      }
      default: {
        const tasks = await Promise.all([getPosts(), getNotes()])
        data.posts = tasks[0]
        data.notes = tasks[1]
      }
    }

    return data
  }

  async getSiteMapContent() {
    const {
      url: { webUrl: baseURL },
    } = await this.configs.waitForConfigReady()

    const combineTasks = await Promise.all([
      this.pageService.model
        .find()
        .lean()
        .then((list) =>
          list.map((doc) => ({
            url: new URL(`/${doc.slug}`, baseURL),
            published_at: doc.modified
              ? new Date(doc.modified)
              : new Date(doc.created!),
          })),
        ),

      this.noteService.model
        .find({
          isPublished: true,

          $or: [
            {
              publicAt: {
                $lte: new Date(),
              },
            },
            {
              publicAt: {
                $exists: false,
              },
            },
            {
              publicAt: null,
            },
          ],
        })
        .lean()
        .then((list) =>
          list.map((doc) => {
            return {
              url: new URL(`/notes/${doc.nid}`, baseURL),
              published_at: doc.modified
                ? new Date(doc.modified)
                : new Date(doc.created!),
            }
          }),
        ),

      this.postService.model
        .find()
        .populate('category')
        .then((list) =>
          list.map((doc) => {
            return {
              url: new URL(
                `/posts/${(doc.category as CategoryModel).slug}/${doc.slug}`,
                baseURL,
              ),
              published_at: doc.modified
                ? new Date(doc.modified)
                : new Date(doc.created!),
            }
          }),
        ),
    ])

    return combineTasks
      .flat()
      .sort((a, b) => -(a.published_at.getTime() - b.published_at.getTime()))
  }

  async buildRssStructure(): Promise<RSSProps> {
    const data = await this.getRSSFeedContent()
    const seo = await this.configs.get('seo')
    const author = (await this.userService.getMaster()).name
    const url = (await this.configs.get('url')).webUrl
    return {
      title: seo.title,
      description: seo.description,
      author,
      url,
      data,
    }
  }
  async getRSSFeedContent() {
    const {
      url: { webUrl },
    } = await this.configs.waitForConfigReady()

    const baseURL = webUrl.replace(/\/$/, '')

    const [posts, notes] = await Promise.all([
      this.postService.model
        .find()
        .limit(10)
        .sort({ created: -1 })
        .populate('category'),

      this.noteService.model
        .find({
          isPublished: true,
          $and: [
            {
              $or: [
                { password: undefined },
                { password: { $exists: false } },
                { password: null },
              ],
            },
            {
              $or: [
                {
                  publicAt: {
                    $lte: new Date(),
                  },
                },
                {
                  publicAt: {
                    $exists: false,
                  },
                },
                {
                  publicAt: null,
                },
              ],
            },
          ],
        })
        .limit(10)
        .sort({ created: -1 }),
    ])

    const postsRss: RSSProps['data'] = posts.map((post) => {
      return {
        id: post.id,
        title: post.title,
        text: post.text,
        created: post.created!,
        modified: post.modified,
        link: baseURL + this.urlService.build(post),
        images: post.images || [],
      }
    })
    const notesRss: RSSProps['data'] = notes.map((note) => {
      return {
        id: note.id,
        title: note.title,
        text: note.text,
        created: note.created!,
        modified: note.modified,
        link: baseURL + this.urlService.build(note),
        images: note.images || [],
      }
    })

    return postsRss
      .concat(notesRss)
      .sort((a, b) => b.created!.getTime() - a.created!.getTime())
      .slice(0, 10)
  }

  async getCounts() {
    const redisClient = this.redisService.getClient()
    const dateFormat = getShortDate(new Date())

    const [
      online,
      posts,
      notes,
      pages,
      says,
      comments,
      allComments,
      unreadComments,
      links,
      linkApply,
      categories,
      recently,
    ] = await Promise.all([
      this.gateway.getCurrentClientCount(),
      this.postService.model.countDocuments(),
      this.noteService.model.countDocuments(),
      this.pageService.model.countDocuments(),
      this.sayService.model.countDocuments(),
      this.commentService.model.countDocuments({
        parent: null,
        $or: [{ state: CommentState.Read }, { state: CommentState.Unread }],
      }),
      this.commentService.model.countDocuments({
        $or: [{ state: CommentState.Read }, { state: CommentState.Unread }],
      }),
      this.commentService.model.countDocuments({
        state: CommentState.Unread,
      }),
      this.linkService.model.countDocuments({
        state: LinkState.Pass,
      }),
      this.linkService.model.countDocuments({
        state: LinkState.Audit,
      }),
      this.categoryService.model.countDocuments({}),
      this.recentlyService.model.countDocuments({}),
    ])

    const [todayMaxOnline, todayOnlineTotal] = await Promise.all([
      redisClient.hget(getRedisKey(RedisKeys.MaxOnlineCount), dateFormat),
      redisClient.hget(
        getRedisKey(RedisKeys.MaxOnlineCount, 'total'),
        dateFormat,
      ),
    ])

    return {
      allComments,
      categories,
      comments,
      linkApply,
      links,
      notes,
      pages,
      posts,
      says,
      recently,
      unreadComments,
      online,
      todayMaxOnline: todayMaxOnline || 0,
      todayOnlineTotal: todayOnlineTotal || 0,
    }
  }

  @OnEvent(EventBusEvents.CleanAggregateCache, { async: true })
  public clearAggregateCache() {
    const redis = this.redisService.getClient()
    return Promise.all([
      redis.del(CacheKeys.RSS),
      redis.del(CacheKeys.RSSXml),
      redis.del(CacheKeys.SiteMap),
      redis.del(CacheKeys.SiteMapXml),
      redis.del(CacheKeys.Aggregate),
      redis.keys(`${API_CACHE_PREFIX}/aggregate*`).then((keys) => {
        return keys.map((key) => redis.del(key))
      }),
      redis.keys(`${CacheKeys.Aggregate}*`).then((keys) => {
        return keys.map((key) => redis.del(key))
      }),
    ])
  }

  async getAllReadAndLikeCount(type: ReadAndLikeCountDocumentType) {
    const pipeline = [
      {
        $match: {
          count: { $exists: true }, // 筛选存在 count 字段的文档
        },
      },
      {
        $group: {
          _id: null, // 不根据特定字段分组
          totalLikes: { $sum: '$count.like' }, // 计算所有文档的 like 总和
          totalReads: { $sum: '$count.read' }, // 计算所有文档的 read 总和
        },
      },
      {
        $project: {
          _id: 0, // 不显示 _id 字段
        },
      },
    ]

    let counts = {
      totalLikes: 0,
      totalReads: 0,
    }

    switch (type) {
      case ReadAndLikeCountDocumentType.Post: {
        const result = await this.postService.model.aggregate(pipeline)
        if (result[0]) counts = result[0]

        break
      }
      case ReadAndLikeCountDocumentType.Note: {
        const result = await this.postService.model.aggregate(pipeline)
        if (result[0]) counts = result[0]
        break
      }
      case ReadAndLikeCountDocumentType.All: {
        const results = await Promise.all([
          this.getAllReadAndLikeCount(ReadAndLikeCountDocumentType.Post),
          this.getAllReadAndLikeCount(ReadAndLikeCountDocumentType.Note),
        ])

        for (const result of results) {
          counts.totalLikes += result.totalLikes
          counts.totalReads += result.totalReads
        }
      }
    }

    return counts
  }

  async getAllSiteWordsCount() {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          text: { $exists: true, $type: 'string' }, // 筛选存在且类型为字符串的 text 字段
        },
      },
      {
        $group: {
          _id: null, // 不根据特定字段分组
          totalCharacters: { $sum: { $strLenCP: '$text' } }, // 计算所有文档的 text 字符长度总和
        },
      },
      {
        $project: {
          _id: 0, // 不显示 _id 字段
        },
      },
    ]
    const results = await Promise.all([
      this.postService.model.aggregate(pipeline),
      this.noteService.model.aggregate(pipeline),
      this.pageService.model.aggregate(pipeline),
    ])

    return results.reduce((prev, curr) => {
      const [result] = curr
      if (!result) return prev
      return prev + result.totalCharacters
    }, 0)
  }
}
