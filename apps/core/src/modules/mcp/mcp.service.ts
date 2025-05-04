import { Injectable } from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'

import { NoteService } from '../note/note.service'
import { PostService } from '../post/post.service'

@Injectable()
export class McpService {
  constructor(
    private readonly postService: PostService,
    private readonly noteService: NoteService,
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
}
