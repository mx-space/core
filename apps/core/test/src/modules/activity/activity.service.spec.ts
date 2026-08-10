import { describe, expect, it, vi } from 'vitest'

import { ActivityService } from '~/modules/activity/activity.service'

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
  id: '7000000000000000060',
  title: 'A Premium Post',
  slug: 'a-premium-post',
  isPremium: true,
  text: 'full premium body',
  content: premiumContent,
  createdAt: new Date(),
}

const createService = (
  postFindRecent: ReturnType<typeof vi.fn>,
  noteFindRecent: ReturnType<typeof vi.fn> = vi.fn(async () => []),
) => {
  const noteService = { findRecent: noteFindRecent }
  return new ActivityService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { findRecent: postFindRecent } as any,
    noteService as any,
    {} as any,
  )
}

describe('ActivityService.getRecentPublish', () => {
  it('requests only published posts and teasers a premium post', async () => {
    const findRecent = vi.fn(async () => [premiumPost])
    const service = createService(findRecent)

    const result = await service.getRecentPublish()

    expect(findRecent).toHaveBeenCalledWith(3, { publishedOnly: true })
    expect(result.post[0].text).not.toContain('full premium body')
    expect(JSON.parse(result.post[0].content).root.children).toHaveLength(2)
  })
})

describe('ActivityService.getLastYearPublication', () => {
  it('requests only published posts and teasers a premium post', async () => {
    const findRecent = vi.fn(async () => [premiumPost])
    const service = createService(findRecent)

    const result = await service.getLastYearPublication()

    expect(findRecent).toHaveBeenCalledWith(50, { publishedOnly: true })
    expect(result.posts[0].text).not.toContain('full premium body')
    expect(JSON.parse(result.posts[0].content).root.children).toHaveLength(2)
  })

  it('asks the post repository to exclude unpublished drafts', async () => {
    const findRecent = vi.fn(async () => [])
    const service = createService(findRecent)

    await service.getLastYearPublication()

    expect(findRecent).toHaveBeenCalledWith(50, { publishedOnly: true })
  })

  it('returns only public note metadata and never private note bodies', async () => {
    const findRecent = vi.fn(async () => [])
    const noteFindRecent = vi.fn(async () => [
      {
        id: 'private-note',
        nid: 38,
        title: 'Private note',
        text: 'private body',
        content: 'private content',
        images: [{ src: 'private-image' }],
        isPublished: false,
        hasPassword: false,
        createdAt: new Date(),
      },
      {
        id: 'password-note',
        nid: 39,
        title: 'Password note',
        text: 'password body',
        content: 'password content',
        isPublished: true,
        hasPassword: true,
        createdAt: new Date(),
      },
      {
        id: 'public-note',
        nid: 41,
        title: 'Public note',
        mood: null,
        weather: null,
        bookmark: false,
        text: 'public body',
        content: 'public content',
        images: [],
        isPublished: true,
        hasPassword: false,
        publicAt: null,
        createdAt: new Date(),
      },
    ])
    const service = createService(findRecent, noteFindRecent)

    const result = await service.getLastYearPublication()

    expect(noteFindRecent).toHaveBeenCalledWith(50, {
      metaOnly: true,
      visibleOnly: true,
    })
    expect(result.notes).toEqual([
      {
        id: 'public-note',
        nid: 41,
        title: 'Public note',
        mood: null,
        weather: null,
        bookmark: false,
        createdAt: expect.any(Date),
      },
    ])
    expect(JSON.stringify(result)).not.toContain('private body')
    expect(JSON.stringify(result)).not.toContain('private content')
    expect(JSON.stringify(result)).not.toContain('private-image')
    expect(JSON.stringify(result)).not.toContain('password body')
  })
})
