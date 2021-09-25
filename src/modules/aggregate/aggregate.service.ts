import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'
import { AnyParamConstructor } from '@typegoose/typegoose/lib/types'
import dayjs from 'dayjs'
import { pick } from 'lodash'
import { FilterQuery } from 'mongoose'
import { URL } from 'url'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { addYearCondition } from '~/utils/query.util'
import { getRedisKey } from '~/utils/redis.util'
import { CategoryModel } from '../category/category.model'
import { CategoryService } from '../category/category.service'
import { CommentState } from '../comment/comment.model'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { LinkState } from '../link/link.model'
import { LinkService } from '../link/link.service'
import { NoteModel } from '../note/note.model'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { RecentlyService } from '../recently/recently.service'
import { SayService } from '../say/say.service'
import { TimelineType } from './aggregate.dto'
import { RSSProps } from './aggregate.interface'
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

    private readonly configs: ConfigsService,
    private readonly gateway: WebEventsGateway,
    private readonly cacheService: CacheService,
  ) {}

  getAllCategory() {
    return this.categoryService.findAllCategory()
  }

  getAllPages() {
    return this.pageService.model.find({}, 'title _id slug order').lean()
  }

  async getLatestNote(cond: FilterQuery<DocumentType<NoteModel>> = {}) {
    return (await this.noteService.getLatestOne(cond)).latest
  }

  private findTop<
    U extends AnyParamConstructor<any>,
    T extends ReturnModelType<U>,
  >(model: T, condition = {}, size = 6) {
    return model
      .find(condition)
      .sort({ created: -1 })
      .limit(size)
      .select('_id title name slug avatar nid created')
  }

  async topActivity(size = 6, isMaster = false) {
    const [notes, posts, says] = await Promise.all([
      this.findTop(
        this.noteService.model,
        !isMaster
          ? {
              hide: false,
              password: undefined,
            }
          : {},
        size,
      ).lean(),

      this.findTop(
        this.postService.model,
        !isMaster ? { hide: false } : {},
        size,
      )
        .populate('categoryId')
        .lean()
        .then((res) => {
          return res.map((post) => {
            post.category = pick(post.categoryId, ['name', 'slug'])
            delete post.categoryId
            return post
          })
        }),

      this.sayService.model.find({}).sort({ create: -1 }).limit(size),
    ])

    return { notes, posts, says }
  }

  async getTimeline(year: number, type: TimelineType, sortBy: 1 | -1 = 1) {
    const data: any = {}
    const getPosts = () =>
      this.postService.model
        .find({ hide: false, ...addYearCondition(year) })
        .sort({ created: sortBy })
        .populate('category')
        .lean()
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
              '/posts/' +
                (item.category as CategoryModel).slug +
                '/' +
                item.slug,
            ),
          })),
        )

    const getNotes = () =>
      this.noteService.model
        .find(
          {
            hide: false,
            password: undefined,
            ...addYearCondition(year),
          },
          '_id nid title weather mood created modified hasMemory',
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
            published_at: new Date(doc.modified),
          })),
        ),

      this.noteService.model
        .find({
          hide: false,
          $or: [
            { password: undefined },
            { password: { $exists: false } },
            { password: null },
          ],
          secret: {
            $lte: new Date(),
          },
        })
        .lean()
        .then((list) =>
          list.map((doc) => {
            return {
              url: new URL(`/notes/${doc.nid}`, baseURL),
              published_at: new Date(doc.modified),
            }
          }),
        ),

      this.postService.model
        .find({
          hide: false,
        })
        .populate('category')
        .then((list) =>
          list.map((doc) => {
            return {
              url: new URL(
                `/posts/${(doc.category as CategoryModel).slug}/${doc.slug}`,
                baseURL,
              ),
              published_at: new Date(doc.modified),
            }
          }),
        ),
    ])

    return combineTasks
      .flat(1)
      .sort((a, b) => -(a.published_at.getTime() - b.published_at.getTime()))
  }

  async buildRssStructure(): Promise<RSSProps> {
    const data = await this.getRSSFeedContent()
    const title = this.configs.get('seo').title
    const author = (await this.configs.getMaster()).name
    const url = this.configs.get('url').webUrl
    return {
      title,
      author,
      url,
      data,
    }
  }
  async getRSSFeedContent() {
    const {
      url: { webUrl: baseURL },
    } = await this.configs.waitForConfigReady()

    const [posts, notes] = await Promise.all([
      this.postService.model
        .find({ hide: false })
        .limit(10)
        .sort({ created: -1 })
        .populate('category'),

      this.noteService.model
        .find({
          hide: false,
          $or: [
            { password: undefined },
            { password: { $exists: false } },
            { password: null },
          ],
        })
        .limit(10)
        .sort({ created: -1 }),
    ])

    const postsRss: RSSProps['data'] = posts.map((post) => {
      return {
        title: post.title,
        text: post.text,
        created: post.created,
        modified: post.modified,
        link: new URL(
          '/posts' + `/${(post.category as CategoryModel).slug}/${post.slug}`,
          baseURL,
        ).toString(),
      }
    })
    const notesRss: RSSProps['data'] = notes.map((note) => {
      const isSecret = note.secret
        ? dayjs(note.secret).isAfter(new Date())
        : false
      return {
        title: note.title,
        text: isSecret ? '这篇文章暂时没有公开呢' : note.text,
        created: note.created,
        modified: note.modified,
        link: new URL('/notes/' + note.nid, baseURL).toString(),
      }
    })
    return postsRss
      .concat(notesRss)
      .sort((a, b) => b.created.getTime() - a.created.getTime())
      .slice(0, 10)
  }

  async getCounts() {
    const online = this.gateway.wsClients.length

    const redisClient = this.cacheService.getClient()
    const dateFormat = dayjs().format('YYYY-MM-DD')

    const [
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
      this.postService.model.countDocuments(),
      this.noteService.model.countDocuments(),
      this.categoryService.model.countDocuments(),
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
      redisClient.get(getRedisKey(RedisKeys.MaxOnlineCount, dateFormat)),
      redisClient.get(
        getRedisKey(RedisKeys.MaxOnlineCount, dateFormat, 'total'),
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
}
