import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors/app-error-code'
import { AppException } from '~/common/errors/exception.types'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { CreatePublishJobSchema } from '~/modules/publish/publish.schema'
import { PublishService } from '~/modules/publish/publish.service'
import type { PublishTaskPayload } from '~/modules/publish/publish.types'
import { type TaskHandler, TaskStatus } from '~/processors/task-queue'

const snapshot = {
  content: null,
  contentFormat: 'markdown',
  images: [],
  meta: { nested: { value: 1 } },
  text: 'Body',
  title: 'Selected title',
  typeSpecificData: { slug: 'selected-title' },
}

const makeBranch = () => ({
  baseRevision: { ...snapshot, id: 'published-1' },
  baseRevisionId: 'published-1',
  commonAncestorRevisionId: 'published-1',
  document: {
    id: 'document-1',
    publishedRevisionId: 'published-1',
    refId: 'post-1',
    refType: DraftRefType.Post,
  },
  documentId: 'document-1',
  headRevision: { ...snapshot, id: 'revision-2' },
  headRevisionId: 'revision-2',
  id: 'branch-1',
  publishedRevision: { ...snapshot, id: 'published-1' },
  relationToPublished: 'ancestor',
  status: 'active',
})

const harness = (options: { online?: boolean } = {}) => {
  const branch = makeBranch()
  const order: string[] = []
  let handler: TaskHandler<PublishTaskPayload> | undefined
  let payload: PublishTaskPayload | undefined
  const drafts = {
    findById: vi.fn(async () => branch),
    linkDocument: vi.fn(),
    recordPublication: vi.fn(async () => ({ kind: 'ok' })),
  }
  const posts = {
    create: vi.fn(),
    findById: vi.fn(async () => ({
      contentFormat: 'markdown',
      id: 'post-1',
      isPublished: options.online ?? true,
    })),
    updateById: vi.fn(async (_id: string, data: { isPublished?: boolean }) => {
      if (data.isPublished === true) order.push('publish')
      return { id: 'post-1', isPublished: true }
    }),
  }
  const aiTask = (name: string) =>
    vi.fn(async () => {
      order.push(name)
      return { taskId: `task-${name}` }
    })
  const aiTasks = {
    createInsightsTask: aiTask('insights'),
    createSummaryTask: aiTask('summary'),
    createTranslationTask: aiTask('translation'),
    createTtsTask: aiTask('tts'),
  }
  const tasks = {
    cancelTask: vi.fn(),
    createTask: vi.fn(async ({ payload: selected }) => {
      payload = selected
      return { id: 'publish-task-1' }
    }),
    getTask: vi.fn(async (id: string) => {
      order.push(`wait:${id}`)
      return { id, status: TaskStatus.Completed }
    }),
  }
  const processor = {
    registerHandler: vi.fn((registered) => {
      handler = registered
    }),
  }
  const service = new PublishService(
    drafts as never,
    posts as never,
    { create: vi.fn(), findById: vi.fn(), updateById: vi.fn() } as never,
    { create: vi.fn(), findById: vi.fn(), updateById: vi.fn() } as never,
    { dryRunMarkdownToLexical: vi.fn() } as never,
    aiTasks as never,
    tasks as never,
    processor as never,
  )
  service.onModuleInit()

  const create = (confirmDiverged = false, aiResources: unknown = []) =>
    service.create({
      aiResources,
      branchId: branch.id,
      confirmDiverged,
      expectedPublishedRevisionId: branch.document.publishedRevisionId,
      revisionId: branch.headRevisionId,
    } as never)
  const run = async (signal = new AbortController().signal) => {
    const setResult = vi.fn()
    await handler!.execute(payload!, {
      appendLog: vi.fn(),
      incrementCost: vi.fn(),
      incrementTokens: vi.fn(),
      isAborted: () => false,
      setResult,
      setStatus: vi.fn(),
      signal,
      streamPusher: vi.fn(),
      taskId: 'publish-task-1',
      updateProgress: vi.fn(),
    })
    return setResult
  }

  return {
    aiTasks,
    branch,
    create,
    drafts,
    order,
    payload: () => payload!,
    posts,
    run,
    tasks,
  }
}

describe('PublishService tree selection', () => {
  it('requires confirmation when publishing a branch from an older base', async () => {
    const { branch, create, tasks } = harness()
    branch.relationToPublished = 'diverged'

    await expect(create()).rejects.toBeInstanceOf(BadRequestException)
    expect(tasks.createTask).not.toHaveBeenCalled()
  })

  it('freezes the explicitly confirmed branch revision', async () => {
    const { branch, create, payload } = harness()
    branch.relationToPublished = 'diverged'

    await create(true)
    branch.headRevision.title = 'Later edit'
    branch.headRevisionId = 'revision-3'

    expect(payload()).toMatchObject({
      branchId: 'branch-1',
      expectedPublishedRevisionId: 'published-1',
      revisionId: 'revision-2',
      snapshot: { title: 'Selected title' },
    })
  })

  it('publishes the frozen revision while newer work remains on the branch', async () => {
    const { branch, create, drafts, posts, run } = harness()
    await create()
    branch.headRevisionId = 'revision-3'
    branch.headRevision.title = 'Later edit'

    const setResult = await run()

    expect(posts.updateById).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({ title: 'Selected title' }),
    )
    expect(drafts.recordPublication).toHaveBeenCalledWith(
      'document-1',
      'revision-2',
      'published-1',
    )
    expect(setResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ newerDraftChanges: true }),
    )
  })

  it('stops when the published pointer changes before the task runs', async () => {
    const { branch, create, posts, run } = harness()
    await create()
    branch.document.publishedRevisionId = 'published-by-other-task'

    const error = await run().catch((reason) => reason)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe(AppErrorCode.PUBLISHED_REVISION_CHANGED)
    expect(posts.updateById).not.toHaveBeenCalled()
  })

  it('reuses the document-linked article when retrying a first publish', async () => {
    const { create, payload, posts, run } = harness()
    await create()
    payload().refId = null

    await run()

    expect(posts.findById).toHaveBeenCalledWith('post-1')
    expect(posts.create).not.toHaveBeenCalled()
  })
})

describe('PublishService AI resource modes', () => {
  it('waits for sync resources before publishing and starts async ones after', async () => {
    const { create, order, run } = harness({ online: false })
    await create(false, [
      { mode: 'async', resource: 'insights' },
      { mode: 'sync', resource: 'summary' },
    ])

    await run()

    expect(order).toEqual([
      'summary',
      'wait:task-summary',
      'publish',
      'insights',
    ])
  })

  it('keeps the article published when an async resource fails to start', async () => {
    const { aiTasks, create, order, run } = harness({ online: false })
    aiTasks.createTranslationTask.mockRejectedValueOnce(new Error('quota'))
    await create(false, [{ mode: 'async', resource: 'translation' }])

    const setResult = await run()

    expect(order).toEqual(['publish'])
    expect(setResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ articleCommitted: true }),
    )
  })

  it('treats legacy resource names as sync', async () => {
    const { create, order, payload, run } = harness({ online: false })
    await create()
    payload().aiResources = ['summary'] as never

    await run()

    expect(order).toEqual(['summary', 'wait:task-summary', 'publish'])
  })

  it('cancels only sync tasks when the publish is aborted', async () => {
    const { aiTasks, create, run, tasks } = harness({ online: false })
    const controller = new AbortController()
    tasks.getTask.mockImplementation(async (id: string) => {
      controller.abort()
      return { id, status: TaskStatus.Running }
    })
    await create(false, [
      { mode: 'sync', resource: 'summary' },
      { mode: 'async', resource: 'insights' },
    ])

    await expect(run(controller.signal)).rejects.toThrow()

    expect(tasks.cancelTask).toHaveBeenCalledWith('task-summary')
    expect(aiTasks.createInsightsTask).not.toHaveBeenCalled()
  })
})

describe('CreatePublishJobSchema aiResources', () => {
  const base = {
    branchId: '1',
    expectedPublishedRevisionId: null,
    revisionId: '2',
  }

  it('normalises legacy names to sync and drops duplicates', () => {
    expect(
      CreatePublishJobSchema.parse({
        ...base,
        aiResources: ['summary', { mode: 'async', resource: 'summary' }, 'tts'],
      }).aiResources,
    ).toEqual([
      { mode: 'sync', resource: 'summary' },
      { mode: 'sync', resource: 'tts' },
    ])
  })
})
