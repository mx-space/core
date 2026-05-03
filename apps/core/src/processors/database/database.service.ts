import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
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
  ) {}

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
}

type IdsCollection = {
  posts: any[]
  notes: any[]
  pages: any[]
  recentlies: any[]
}
