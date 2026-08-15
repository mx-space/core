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

describe('ActivityService presence persist dedupe', () => {
  it('persists a read-duration once when disconnect fires every hook', async () => {
    const hooks: Record<string, ((...args: any[]) => Promise<void>)[]> = {
      onDisconnected: [],
      onLeaveRoom: [],
    }
    const webGateway = {
      registerHook: vi.fn((name: string, fn: any) => {
        hooks[name].push(fn)
        return () => {}
      }),
      broadcast: vi.fn(),
    }
    const meta = {
      presence: {
        connectedAt: 1000,
        operationTime: 200_000,
        updatedAt: 200_000,
        position: 5,
        roomName: 'article-1',
        displayName: 'reader',
        ip: '::1',
        identity: 'id-1',
      },
      roomJoinedAtMap: { 'article-1': 100_000 },
    }
    const gatewayService = { getSocketMetadata: vi.fn(async () => meta) }
    const activityRepository = { create: vi.fn(async () => ({})) }
    const service = new ActivityService(
      {} as any,
      {} as any,
      activityRepository as any,
      {} as any,
      {} as any,
      webGateway as any,
      gatewayService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )
    service.onModuleInit()

    const socket = { id: 'conn-1' }
    await Promise.all([
      hooks.onDisconnected[0](socket),
      hooks.onLeaveRoom[0](socket, 'article-1'),
      hooks.onLeaveRoom[0](socket, 'lang:zh'),
    ])

    expect(activityRepository.create).toHaveBeenCalledTimes(1)
    service.onModuleDestroy()
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
