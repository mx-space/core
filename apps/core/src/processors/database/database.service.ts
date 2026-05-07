import { Injectable } from '@nestjs/common'

import { CollectionRefTypes } from '~/constants/db.constant'
import { NoteRepository } from '~/modules/note/note.repository'
import type { NoteRow } from '~/modules/note/note.types'
import { PageRepository } from '~/modules/page/page.repository'
import type { PageRow } from '~/modules/page/page.types'
import { PostRepository } from '~/modules/post/post.repository'
import type { PostRow } from '~/modules/post/post.types'
import { RecentlyRepository } from '~/modules/recently/recently.repository'
import type { RecentlyRow } from '~/modules/recently/recently.types'
import { isEntityIdString, parseEntityId } from '~/shared/id/entity-id'

type GlobalDocumentResult =
  | { document: PostRow; type: CollectionRefTypes.Post }
  | { document: NoteRow; type: CollectionRefTypes.Note }
  | { document: PageRow; type: CollectionRefTypes.Page }
  | { document: RecentlyRow; type: CollectionRefTypes.Recently }

@Injectable()
export class DatabaseService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly noteRepository: NoteRepository,
    private readonly pageRepository: PageRepository,
    private readonly recentlyRepository: RecentlyRepository,
  ) {}

  public async findGlobalById(
    id: string,
  ): Promise<GlobalDocumentResult | null> {
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
      document: doc[index]!,
      type: [
        CollectionRefTypes.Post,
        CollectionRefTypes.Note,
        CollectionRefTypes.Page,
        CollectionRefTypes.Recently,
      ][index],
    } as GlobalDocumentResult
  }

  public async findGlobalByIds(ids: string[]): Promise<IdsCollection> {
    const validIds = ids.filter(isEntityIdString)
    const [posts, notes, pages, recentlies] = await Promise.all([
      this.postRepository.findManyByIds(validIds),
      this.noteRepository.findManyByIds(validIds),
      this.pageRepository.findManyByIds(validIds),
      this.recentlyRepository.findManyByIds(validIds),
    ])
    return {
      posts,
      notes,
      pages,
      recentlies,
    }
  }

  public findPostBySlug(slug: string) {
    return this.postRepository.findBySlug(slug)
  }

  public findNoteByNid(nid: number) {
    return this.noteRepository.findByNid(nid)
  }

  public findNoteByDateAndSlug(
    year: number,
    month: number,
    day: number,
    slug: string,
  ) {
    const start = new Date(Date.UTC(year, month - 1, day))
    const end = new Date(Date.UTC(year, month - 1, day + 1))
    return this.noteRepository.findOneByDateAndSlug(start, end, slug)
  }

  public async findPostAndNoteIdsByTitle(search: string): Promise<string[]> {
    const normalizedSearch = search.trim()
    if (!normalizedSearch) return []
    const [posts, notes] = await Promise.all([
      this.postRepository.findIdsByTitle(normalizedSearch),
      this.noteRepository.findIdsByTitle(normalizedSearch),
    ])
    return [...new Set([...posts, ...notes])]
  }

  flatCollectionToMap(combinedCollection: IdsCollection) {
    const all = {} as Record<string, PostRow | NoteRow | PageRow | RecentlyRow>
    for (const collection of Object.values(combinedCollection)) {
      for (const item of collection) {
        all[item.id] = item
      }
    }
    return all
  }
}

type IdsCollection = {
  posts: PostRow[]
  notes: NoteRow[]
  pages: PageRow[]
  recentlies: RecentlyRow[]
}
