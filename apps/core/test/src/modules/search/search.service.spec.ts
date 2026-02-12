import { Test } from '@nestjs/testing'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { SearchService } from '~/modules/search/search.service'
import { DatabaseService } from '~/processors/database/database.service'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('SearchService', () => {
  let searchService: SearchService
  let mockNoteService: {
    model: {
      paginate: ReturnType<typeof vi.fn>
    }
  }
  let mockPostService: {
    model: {
      paginate: ReturnType<typeof vi.fn>
    }
  }

  beforeEach(async () => {
    mockNoteService = {
      model: {
        paginate: vi.fn(),
      },
    }

    mockPostService = {
      model: {
        paginate: vi.fn(),
      },
    }

    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: NoteService, useValue: mockNoteService },
        { provide: POST_SERVICE_TOKEN, useValue: mockPostService },
        { provide: PageService, useValue: {} },
        { provide: ConfigsService, useValue: {} },
        { provide: DatabaseService, useValue: {} },
      ],
    }).compile()

    searchService = module.get(SearchService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should apply weighted sort for note search results', async () => {
    mockNoteService.model.paginate.mockResolvedValue({
      docs: [
        {
          _id: 'note-a',
          title: 'hello world',
          text: 'content',
          created: new Date('2024-01-01'),
        },
        {
          _id: 'note-b',
          title: '',
          text: 'hello hello',
          created: new Date('2024-01-02'),
        },
        {
          _id: 'note-c',
          title: 'hello',
          text: 'hello',
          created: new Date('2024-01-03'),
          modified: new Date('2024-01-04'),
        },
      ],
      totalDocs: 3,
      limit: 10,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })

    const result = await searchService.searchNote(
      { keyword: 'hello', page: 1, size: 10 } as any,
      true,
    )

    expect(result.data.map((item) => item._id)).toEqual([
      'note-b',
      'note-c',
      'note-a',
    ])
    expect(result.data.some((item) => 'text' in item)).toBe(false)
  })

  it('should use modified/created as tie breaker for post search', async () => {
    mockPostService.model.paginate.mockResolvedValue({
      docs: [
        {
          _id: 'post-a',
          title: 'hello',
          text: 'content',
          created: new Date('2024-01-01'),
        },
        {
          _id: 'post-b',
          title: 'hello',
          text: 'content',
          created: new Date('2024-01-02'),
          modified: new Date('2024-01-03'),
        },
      ],
      totalDocs: 2,
      limit: 10,
      page: 1,
      totalPages: 1,
    })

    const result = await searchService.searchPost({
      keyword: 'hello',
      page: 1,
      size: 10,
    } as any)

    expect(result.docs.map((item) => item._id)).toEqual(['post-b', 'post-a'])
    expect(result.docs.some((item) => 'text' in item)).toBe(false)
  })
})
