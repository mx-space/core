import { Inject, Injectable } from '@nestjs/common'
import { mongoose } from '@typegoose/typegoose'

import { CollectionRefTypes } from '~/constants/db.constant'
import { DB_CONNECTION_TOKEN } from '~/constants/system.constant'
import { NoteRepository } from '~/modules/note/note.repository'
import { PageRepository } from '~/modules/page/page.repository'
import { PostRepository } from '~/modules/post/post.repository'
import { RecentlyRepository } from '~/modules/recently/recently.repository'
import { parseEntityId } from '~/shared/id/entity-id'

@Injectable()
export class DatabaseService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly noteRepository: NoteRepository,
    private readonly pageRepository: PageRepository,
    private readonly recentlyRepository: RecentlyRepository,
    @Inject(DB_CONNECTION_TOKEN) private connection: mongoose.Connection,
  ) {}

  private repositoryByType(type: any) {
    const normalized = String(type).toLowerCase()
    const map = new Map<any, any>([
      ['post', this.postRepository],
      ['posts', this.postRepository],
      ['note', this.noteRepository],
      ['notes', this.noteRepository],
      ['page', this.pageRepository],
      ['pages', this.pageRepository],
      ['recently', this.recentlyRepository],
      ['recentlies', this.recentlyRepository],
    ])
    return map.get(normalized)
  }

  public getModelByRefType(type: any): any {
    const repository = this.repositoryByType(type)
    return {
      findById: (id: string) => ({
        lean: async () => repository.findById(id),
        select: () => ({ lean: async () => repository.findById(id) }),
        then: (resolve: any, reject: any) =>
          repository.findById(id).then(resolve, reject),
      }),
      find: (filter: { _id?: { $in?: string[] } } = {}) => ({
        lean: async () =>
          filter._id?.$in ? repository.findManyByIds(filter._id.$in) : [],
      }),
      updateOne: async () => ({ modifiedCount: 0 }),
    }
  }

  public async findGlobalById(id: string): Promise<any> {
    parseEntityId(id)
    const doc = await Promise.all([
      this.postRepository.findById(id),
      this.noteRepository.findById(id),
      this.pageRepository.findById(id),
      this.recentlyRepository.findById(id),
    ])
    const index = doc.findIndex(Boolean)
    if (index === -1) return null
    return {
      document: doc[index],
      type: [
        CollectionRefTypes.Post,
        CollectionRefTypes.Note,
        CollectionRefTypes.Page,
        CollectionRefTypes.Recently,
      ][index],
    }
  }

  public async findGlobalByIds(ids: string[]): Promise<IdsCollection> {
    const [posts, notes, pages, recentlies] = await Promise.all([
      this.postRepository.findManyByIds(ids),
      this.noteRepository.findManyByIds(ids),
      this.pageRepository.findManyByIds(ids),
      this.recentlyRepository.findManyByIds(ids),
    ])
    return {
      posts: posts as any[],
      notes: notes as any[],
      pages: pages as any[],
      recentlies: recentlies as any[],
    }
  }

  flatCollectionToMap(combinedCollection: IdsCollection) {
    const all = {} as Record<string, any>
    for (const key in combinedCollection) {
      const collection = combinedCollection[key]
      for (const item of collection) {
        all[item.id] = item
      }
    }
    return all
  }

  public get db() {
    return this.connection.db!
  }

  public get mongooseConnection() {
    return this.connection
  }

  public get client() {
    return this.connection.getClient()
  }
}

type IdsCollection = {
  posts: any[]
  notes: any[]
  pages: any[]
  recentlies: any[]
}
