import { Test } from '@nestjs/testing'
import { CategoryModel } from '~/modules/category/category.model'
import { MarkdownService } from '~/modules/markdown/markdown.service'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { getModelToken } from '~/transformers/model.transformer'
import { vi } from 'vitest'

describe('test Markdown Service', () => {
  let service: MarkdownService

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      providers: [
        MarkdownService,
        {
          provide: getModelToken(CategoryModel.name),
          useValue: vi.fn(),
        },
        {
          provide: getModelToken(PostModel.name),
          useValue: vi.fn(),
        },
        {
          provide: getModelToken(NoteModel.name),
          useValue: vi.fn(),
        },
        {
          provide: getModelToken(PageModel.name),
          useValue: vi.fn(),
        },
        {
          provide: AssetService,
          useValue: vi.fn(),
        },
        {
          provide: DatabaseService,
          useValue: vi.fn(),
        },

        {
          provide: TextMacroService,
          useValue: {
            replaceTextMacro: vi.fn(),
          },
        },
      ],
    }).compile()

    service = ref.get(MarkdownService)
  })

  it('should render markdown to html', async () => {
    const html = service.renderMarkdownContent('# title')
    expect(html).toBe('<h1>title</h1>\n')
  })
})
