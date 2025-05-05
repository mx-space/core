import { Injectable } from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'

import { CategoryService } from '../category/category.service'
import { CommentService } from '../comment/comment.service'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { RecentlyService } from '../recently/recently.service'
import { SayService } from '../say/say.service'

@Injectable()
export class McpService {
  constructor(
    private readonly postService: PostService,
    private readonly noteService: NoteService,
    private readonly categoryService: CategoryService,
    private readonly pageService: PageService,
    private readonly sayService: SayService,
    private readonly recentlyService: RecentlyService,
    private readonly commentService: CommentService,
  ) {}

  /**
   * Get a post by ID
   * @param id Post ID
   * @returns The requested post
   */
  async getPostById(id: string) {
    const post = await this.postService.model
      .findById(id)
      .populate('category')
      .populate({
        path: 'related',
        select: 'title slug id _id categoryId category',
      })

    if (!post) {
      throw new CannotFindException()
    }

    return post
  }

  /**
   * Get posts with pagination
   * @param page Page number
   * @param size Page size
   * @returns Paginated posts
   */
  async getPosts(page = 1, size = 10) {
    const query = this.postService.model
      .find()
      .populate('category')
      .sort({ created: -1 })
      .skip((page - 1) * size)
      .limit(size)

    const posts = await query.exec()
    const total = await this.postService.model.countDocuments()

    return {
      data: posts,
      pagination: {
        total,
        size,
        currentPage: page,
        totalPage: Math.ceil(total / size),
      },
    }
  }

  /**
   * Get a note by ID
   * @param id Note ID or nid
   * @returns The requested note
   */
  async getNoteById(id: string | number) {
    const note = await this.noteService.findOneByIdOrNid(id)

    if (!note) {
      throw new CannotFindException()
    }

    return note
  }

  /**
   * Get notes with pagination
   * @param page Page number
   * @param size Page size
   * @returns Paginated notes
   */
  async getNotes(page = 1, size = 10) {
    const query = this.noteService.model
      .find({ hide: false })
      .sort({ created: -1 })
      .skip((page - 1) * size)
      .limit(size)

    const notes = await query.exec()
    const total = await this.noteService.model.countDocuments({ hide: false })

    return {
      data: notes,
      pagination: {
        total,
        size,
        currentPage: page,
        totalPage: Math.ceil(total / size),
      },
    }
  }

  async getLatestPost() {
    const post = await this.postService.model.findOne().sort({ created: -1 })

    if (!post) {
      throw new CannotFindException()
    }

    return post
  }

  async getLatestNotes() {
    const notes = await this.noteService.model.findOne().sort({ created: -1 })

    if (!notes) {
      throw new CannotFindException()
    }

    return notes
  }

  /**
   * Get a category by ID
   * @param id Category ID
   * @returns The requested category with post count
   */
  async getCategoryById(id: string) {
    const category = await this.categoryService.findCategoryById(id)

    if (!category) {
      throw new CannotFindException()
    }

    return category
  }

  /**
   * Get all categories
   * @returns All categories with post counts
   */
  async getAllCategories() {
    return await this.categoryService.findAllCategory()
  }

  /**
   * Get posts in a specific category
   * @param categoryId Category ID
   * @returns Posts in the specified category
   */
  async getPostsByCategory(categoryId: string) {
    const posts = await this.categoryService.findCategoryPost(categoryId)

    if (!posts || posts.length === 0) {
      throw new CannotFindException()
    }

    return posts
  }

  /**
   * Get a summary of all tags and their post counts
   * @returns Tags with post counts
   */
  async getTagsSummary() {
    return await this.categoryService.getPostTagsSum()
  }

  /**
   * Get posts with a specific tag
   * @param tag Tag name
   * @returns Posts with the specified tag
   */
  async getPostsByTag(tag: string) {
    return await this.categoryService.findArticleWithTag(tag)
  }

  /**
   * Get a page by ID
   * @param id Page ID
   * @returns The requested page
   */
  async getPageById(id: string) {
    const page = await this.pageService.model.findById(id)

    if (!page) {
      throw new CannotFindException()
    }

    return page
  }

  /**
   * Get all pages
   * @returns All pages
   */
  async getAllPages() {
    const pages = await this.pageService.model.find().sort({ order: 1 })
    return pages
  }

  /**
   * Get all says (quotes/status updates)
   * @returns All says
   */
  async getAllSays() {
    const says = await this.sayService.model.find().sort({ created: -1 })
    return says
  }

  /**
   * Get a random say
   * @returns A random say
   */
  async getRandomSay() {
    const res = await this.sayService.model.find({}).lean()
    if (res.length === 0) {
      throw new CannotFindException()
    }

    // Get a random item from the array
    const randomIndex = Math.floor(Math.random() * res.length)
    return res[randomIndex]
  }

  /**
   * Get all recently activity
   * @returns All recently activity
   */
  async getAllRecently() {
    return await this.recentlyService.getAll()
  }

  /**
   * Get a specific recently activity by ID
   * @param id Recently activity ID
   * @returns The requested recently activity
   */
  async getRecentlyById(id: string) {
    const recently = await this.recentlyService.getOne(id)

    if (!recently) {
      throw new CannotFindException()
    }

    return recently
  }

  /**
   * Get latest recently activities with pagination
   * @param size Number of items to retrieve
   * @param before Retrieve items before this ID
   * @param after Retrieve items after this ID
   * @returns Paginated recently activities
   */
  async getRecentlyOffset({
    size = 10,
    before,
    after,
  }: {
    size?: number
    before?: string
    after?: string
  }) {
    return await this.recentlyService.getOffset({ size, before, after })
  }

  /**
   * Get the latest recently activity
   * @returns The latest recently activity
   */
  async getLatestRecently() {
    const recently = await this.recentlyService.getLatestOne()

    if (!recently) {
      throw new CannotFindException()
    }

    return recently
  }

  /**
   * Get comments with pagination
   * @param page Page number
   * @param size Page size
   * @param state Comment state filter (0 = all)
   * @returns Paginated comments
   */
  async getComments({ page = 1, size = 10, state = 0 } = {}) {
    return await this.commentService.getComments({ page, size, state })
  }

  /**
   * Get comments for a specific content
   * @param id Content ID
   * @param type Content type (post, page, note, etc.)
   * @returns Comments for the specified content
   */
  async getContentComments(id: string, type?: string) {
    const allowComment = await this.commentService.allowComment(id, type as any)

    if (!allowComment) {
      return []
    }

    const comments = await this.commentService.model.find({
      ref: id,
    })

    await this.commentService.fillAndReplaceAvatarUrl(comments)

    return comments
  }
}
