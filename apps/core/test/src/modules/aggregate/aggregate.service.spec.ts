import { describe, expect, it, vi } from 'vitest'

import { AggregateService } from '~/modules/aggregate/aggregate.service'

const noteRow = {
  id: '7000000000000000070',
  nid: 1,
  title: 'A Note',
  slug: null,
  text: 'note body markdown',
  content: '{"root":{"children":[]}}',
  contentFormat: 'lexical',
  images: [],
  meta: null,
  mood: null,
  weather: null,
  createdAt: new Date('2024-09-01T00:00:00.000Z'),
  modifiedAt: null,
}

const postRow = {
  id: '7000000000000000060',
  title: 'A Post',
  slug: 'a-post',
  text: '## heading\n\nbody',
  content: '{"root":{"children":[]}}',
  contentFormat: 'lexical',
  summary: 'sum',
  images: [],
  meta: { cover: 'x.png' },
  category: { id: '7000000000000000900', slug: 'tech', name: 'Tech', type: 0 },
  createdAt: new Date('2024-02-01T00:00:00.000Z'),
  modifiedAt: null,
}

const createService = () => {
  const postService = { findRecent: vi.fn(async () => [postRow]) }
  const noteService = { findRecent: vi.fn(async () => [noteRow]) }
  const sayService = {
    findRecent: vi.fn(async () => [{ id: '7000000000000000300', text: 'hi' }]),
  }
  const recentlyService = {
    findRecent: vi.fn(async () => [
      { id: '7000000000000000400', content: 'noted' },
    ]),
  }

  const service = new AggregateService(
    postService as any,
    noteService as any,
    {} as any,
    {} as any,
    sayService as any,
    {} as any,
    {} as any,
    recentlyService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )
  return { service }
}

describe('AggregateService.topActivity', () => {
  it('omits article bodies but keeps the metadata the homepage renders', async () => {
    const { service } = createService()
    const result = await service.topActivity(5)

    expect(result.notes[0]).not.toHaveProperty('text')
    expect(result.notes[0]).not.toHaveProperty('content')
    expect(result.posts[0]).not.toHaveProperty('text')
    expect(result.posts[0]).not.toHaveProperty('content')

    expect(result.notes[0]).toMatchObject({
      id: '7000000000000000070',
      nid: 1,
      title: 'A Note',
      meta: null,
    })
    expect(result.posts[0]).toMatchObject({
      id: '7000000000000000060',
      slug: 'a-post',
      title: 'A Post',
      summary: 'sum',
      category: { slug: 'tech' },
    })
  })
})

describe('AggregateService.buildRssStructure', () => {
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

  it('emits a teaser, not the full body, for a premium post', async () => {
    const premiumPost = {
      ...postRow,
      isPremium: true,
      text: 'full premium body',
      content: premiumContent,
    }
    const postService = { findRecent: vi.fn(async () => [premiumPost]) }
    const noteService = { findRecent: vi.fn(async () => []) }
    const ownerService = { getOwner: vi.fn(async () => ({ name: 'Owner' })) }
    const configs = {
      get: vi.fn(async (key: string) =>
        key === 'seo'
          ? { title: 'Blog', description: 'desc' }
          : { webUrl: 'https://example.com' },
      ),
    }
    const urlBuilder = { build: vi.fn(() => '/tech/a-post') }

    const service = new AggregateService(
      postService as any,
      noteService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      ownerService as any,
      configs as any,
      {} as any,
      {} as any,
      {} as any,
      urlBuilder as any,
    )

    const { data } = await service.buildRssStructure()

    expect(data).toHaveLength(1)
    expect(data[0].text).not.toContain('full premium body')
    expect(JSON.parse(data[0].content!).root.children).toHaveLength(2)
  })
})
