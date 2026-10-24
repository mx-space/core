import { forwardRef, Inject, Injectable } from '@nestjs/common'

import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { PostService } from '~/modules/post/post.service'
import { SearchService } from '~/modules/search/search.service'

import type {
  AgentArticleSource,
  ArticleBody,
  ArticleSearchHit,
  ArticleType,
} from './ai-agent-server-tools'

interface ArticleRow {
  id: string
  title: string
  createdAt: Date | string | null
  contentFormat?: string | null
  content?: string | null
  text?: string | null
}

@Injectable()
export class AiAgentArticleSource implements AgentArticleSource {
  constructor(
    @Inject(forwardRef(() => SearchService))
    private readonly searchService: SearchService,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,
    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,
  ) {}

  async search(query: {
    keyword: string
    type?: ArticleType
    limit: number
  }): Promise<ArticleSearchHit[]> {
    const result = await this.searchService.search(
      { keyword: query.keyword, page: 1, size: query.limit },
      { asAdmin: true, refType: query.type },
    )
    return (result.data as Array<Record<string, any>>).map((item) => ({
      type: (item.type ?? query.type) as ArticleType,
      id: String(item.id),
      title: String(item.title ?? ''),
      createdAt: toIso(item.createdAt),
      snippet: String(item.highlight?.snippet ?? ''),
    }))
  }

  async load(type: ArticleType, id: string): Promise<ArticleBody | null> {
    const row = (await this.find(type, id)) as ArticleRow | null
    if (!row) return null
    return {
      type,
      id: String(row.id),
      title: row.title,
      createdAt: toIso(row.createdAt),
      contentFormat: row.contentFormat ?? 'markdown',
      content: row.content ?? null,
      text: row.text ?? null,
    }
  }

  private find(type: ArticleType, id: string) {
    switch (type) {
      case 'post': {
        return this.postService.findById(id)
      }
      case 'note': {
        return this.noteService.findById(id)
      }
      case 'page': {
        return this.pageService.findById(id)
      }
    }
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : ''
}
