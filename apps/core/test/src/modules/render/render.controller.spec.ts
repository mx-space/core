import { describe, expect, it, vi } from 'vitest'

import { RequestContext } from '~/common/contexts/request.context'
import { CollectionRefTypes } from '~/constants/db.constant'
import { RenderEjsController } from '~/modules/render/render.controller'

const premiumContent = JSON.stringify({
  root: {
    children: [
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const premiumPost = {
  id: 'post-1',
  title: 'Premium Post',
  isPublished: true,
  isPremium: true,
  password: null,
  text: 'full premium body',
  content: premiumContent,
  createdAt: new Date(),
  slug: 'premium-post',
  category: { slug: 'tech' },
}

const createController = () => {
  const markdownService = {
    renderArticle: vi.fn(
      async (_id: string, options?: { asOwner?: boolean }) => ({
        html: options?.asOwner ? `<p>${premiumPost.text}</p>` : '<p></p>',
        document: premiumPost,
        type: CollectionRefTypes.Post,
      }),
    ),
    getRenderedMarkdownHtmlStructure: vi
      .fn()
      .mockResolvedValue({ body: [], style: [] }),
    getMarkdownEjsRenderTemplate: vi.fn().mockResolvedValue('<%- body %>'),
  }
  const configs = {
    waitForConfigReady: vi
      .fn()
      .mockResolvedValue({ url: { webUrl: 'https://example.com' } }),
  }
  const ownerService = {
    getOwner: vi.fn().mockResolvedValue({ name: 'Owner' }),
  }
  const controller = new RenderEjsController(
    markdownService as any,
    configs as any,
    ownerService as any,
  )
  return { controller, markdownService }
}

const runWithAdminAccess = <T>(hasAdminAccess: boolean, fn: () => Promise<T>) =>
  RequestContext.run(
    new RequestContext({ hasAdminAccess } as any, {} as any),
    fn,
  )

describe('RenderEjsController.renderArticle', () => {
  it('requests the teaser for an unauthenticated visitor', async () => {
    const { controller, markdownService } = createController()

    await runWithAdminAccess(false, () =>
      controller.renderArticle({ id: 'post-1' } as any, undefined as any),
    )

    expect(markdownService.renderArticle).toHaveBeenCalledWith('post-1', {
      asOwner: false,
    })
  })

  it('requests the full body for an admin-authenticated request', async () => {
    const { controller, markdownService } = createController()

    await runWithAdminAccess(true, () =>
      controller.renderArticle({ id: 'post-1' } as any, undefined as any),
    )

    expect(markdownService.renderArticle).toHaveBeenCalledWith('post-1', {
      asOwner: true,
    })
  })
})
