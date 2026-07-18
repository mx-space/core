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

const createService = (postFindRecent: ReturnType<typeof vi.fn>) => {
  const noteService = { findRecent: vi.fn(async () => []) }
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
})
