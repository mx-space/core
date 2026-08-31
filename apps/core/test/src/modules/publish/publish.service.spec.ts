import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors/app-error-code'
import { AppException } from '~/common/errors/exception.types'
import { DraftRefType } from '~/modules/draft/draft.enum'
import { PublishService } from '~/modules/publish/publish.service'
import type { PublishTaskPayload } from '~/modules/publish/publish.types'
import type { TaskHandler } from '~/processors/task-queue'

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

const harness = () => {
  const branch = makeBranch()
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
      isPublished: true,
    })),
    updateById: vi.fn(async () => ({ id: 'post-1', isPublished: true })),
  }
  const tasks = {
    cancelTask: vi.fn(),
    createTask: vi.fn(async ({ payload: selected }) => {
      payload = selected
      return { id: 'publish-task-1' }
    }),
    getTask: vi.fn(),
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
    {
      createInsightsTask: vi.fn(),
      createSummaryTask: vi.fn(),
      createTranslationTask: vi.fn(),
      createTtsTask: vi.fn(),
    } as never,
    tasks as never,
    processor as never,
  )
  service.onModuleInit()

  const create = (confirmDiverged = false) =>
    service.create({
      aiResources: [],
      branchId: branch.id,
      confirmDiverged,
      expectedPublishedRevisionId: branch.document.publishedRevisionId,
      revisionId: branch.headRevisionId,
    } as never)
  const run = async () => {
    const setResult = vi.fn()
    await handler!.execute(payload!, {
      appendLog: vi.fn(),
      incrementCost: vi.fn(),
      incrementTokens: vi.fn(),
      isAborted: () => false,
      setResult,
      setStatus: vi.fn(),
      signal: new AbortController().signal,
      streamPusher: vi.fn(),
      taskId: 'publish-task-1',
      updateProgress: vi.fn(),
    })
    return setResult
  }

  return { branch, create, drafts, payload: () => payload!, posts, run, tasks }
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
