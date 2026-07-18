import { describe, expect, it, vi } from 'vitest'

import { FeedController } from '~/modules/feed/feed.controller'
import { ContentFormat } from '~/shared/types/content-format.type'

describe('FeedController.rss', () => {
  it('never emits full body text for a premium (lexical) post', async () => {
    const premiumItem = {
      id: 'post-1',
      title: 'Premium Post',
      link: 'https://example.com/posts/tech/premium-post',
      created: new Date(),
      text: 'full premium body',
      content: 'full premium content',
      contentFormat: ContentFormat.Lexical,
      images: [],
    }
    const aggregateService = {
      buildRssStructure: vi.fn().mockResolvedValue({
        author: 'Owner',
        description: 'desc',
        url: 'https://example.com',
        data: [premiumItem],
      }),
    }
    const configs = {
      get: vi.fn(async (key: string) =>
        key === 'seo'
          ? { title: 'Blog', description: 'desc' }
          : { webUrl: 'https://example.com' },
      ),
    }
    const ownerService = { getOwner: vi.fn().mockResolvedValue({ avatar: '' }) }
    const markdownService = {
      renderArticle: vi.fn().mockResolvedValue({
        html: '<p>full premium body rendered</p>',
        type: 'Post',
        document: { text: 'full premium body', category: { name: 'Tech' } },
      }),
    }

    const controller = new FeedController(
      aggregateService as any,
      configs as any,
      ownerService as any,
      markdownService as any,
    )

    const xml = await controller.rss()

    expect(xml).not.toContain('full premium body')
    expect(xml).not.toContain('full premium content')
  })
})
