import { describe, expect, it, vi } from 'vitest'

import { MarkdownController } from '~/modules/markdown/markdown.controller'

describe('MarkdownController.getRenderedMarkdownHtmlStructure', () => {
  it('never passes asOwner, so premium content stays teased regardless of caller identity', async () => {
    const service = {
      renderArticle: vi.fn().mockResolvedValue({
        html: '<p>teaser</p>',
        document: { title: 'Premium Post' },
      }),
      getRenderedMarkdownHtmlStructure: vi
        .fn()
        .mockResolvedValue({ body: ['<p>teaser</p>'] }),
    }
    const controller = new MarkdownController(service as any)

    await controller.getRenderedMarkdownHtmlStructure({ id: 'post-1' } as any)

    expect(service.renderArticle).toHaveBeenCalledWith('post-1')
    expect(service.renderArticle).not.toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({ asOwner: true }),
    )
  })
})
