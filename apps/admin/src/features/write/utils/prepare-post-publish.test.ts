import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ai from '~/api/ai'
import { AITaskStatus } from '~/api/tasks'
import * as tasks from '~/api/tasks'
import * as notes from '~/data/resources/note.mutations'
import * as posts from '~/data/resources/post.mutations'
import { jotaiStore } from '~/store/jotai-store'

import {
  cancelPublishProcess,
  prepareAndPublishNote,
  prepareAndPublishPost,
} from './prepare-post-publish'
import {
  publishProcessDockOpenAtom,
  publishProcessesAtom,
} from './publish-process-state'

vi.mock('~/api/ai', () => ({
  createInsightsTask: vi.fn(),
  createSummaryTask: vi.fn(),
  createTranslationTask: vi.fn(),
  createTtsTask: vi.fn(),
}))
vi.mock('~/api/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/tasks')>()),
  cancelTask: vi.fn(),
  getTask: vi.fn(),
}))
vi.mock('~/data/resources/post.mutations', () => ({
  publishPost: vi.fn(),
  savePost: vi.fn(),
}))
vi.mock('~/data/resources/note.mutations', () => ({
  publishNote: vi.fn(),
  saveNote: vi.fn(),
}))

const post = {
  id: 'post-1',
  isPublished: false,
  title: 'Post',
} as Awaited<ReturnType<typeof posts.savePost>>

describe('prepareAndPublishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    jotaiStore.set(publishProcessesAtom, [])
    jotaiStore.set(publishProcessDockOpenAtom, false)
    vi.mocked(posts.savePost).mockResolvedValue(post)
    vi.mocked(posts.publishPost).mockResolvedValue({
      ...post,
      isPublished: true,
    })
    vi.mocked(notes.saveNote).mockResolvedValue(post as never)
    vi.mocked(notes.publishNote).mockResolvedValue({
      ...post,
      isPublished: true,
    } as never)
    vi.mocked(ai.createSummaryTask).mockResolvedValue({
      created: true,
      taskId: 'summary-1',
    })
    vi.mocked(ai.createTranslationTask).mockResolvedValue({
      created: true,
      taskId: 'translation-1',
    })
    vi.mocked(tasks.cancelTask).mockResolvedValue({ success: true })
    vi.mocked(tasks.getTask).mockResolvedValue({
      id: 'task-1',
      status: AITaskStatus.Completed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)
  })

  it('hands off immediately and publishes only after every task completes', async () => {
    const taskResolvers = new Map<
      string,
      (task: Awaited<ReturnType<typeof tasks.getTask>>) => void
    >()
    vi.mocked(tasks.getTask).mockImplementation(
      (taskId) => new Promise((resolve) => taskResolvers.set(taskId, resolve)),
    )

    const result = await prepareAndPublishPost({
      config: {
        summaryTargetLanguages: ['en'],
        translationTargetLanguages: ['ja'],
      },
      data: { categoryId: 'cat-1', text: 'Body', title: 'Post' },
      id: '',
      resources: ['summary', 'translation'],
    })

    expect(posts.savePost).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        isPublished: false,
        skipAiAutoGeneration: true,
      }),
    )
    expect(ai.createSummaryTask).toHaveBeenCalledWith({
      refId: 'post-1',
      targetLanguages: ['en'],
    })
    expect(ai.createTranslationTask).toHaveBeenCalledWith({
      refId: 'post-1',
      targetLanguages: ['ja'],
    })
    expect(result.isPublished).toBe(false)
    expect(posts.publishPost).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(taskResolvers.size).toBe(2))
    taskResolvers.get('summary-1')?.({
      id: 'summary-1',
      status: AITaskStatus.Completed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)
    await Promise.resolve()
    expect(posts.publishPost).not.toHaveBeenCalled()

    taskResolvers.get('translation-1')?.({
      id: 'translation-1',
      status: AITaskStatus.Completed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)
    await vi.waitFor(() =>
      expect(posts.publishPost).toHaveBeenCalledWith('post-1', true, {
        preparedAiResources: ['summary', 'translation'],
      }),
    )
    await vi.waitFor(() =>
      expect(jotaiStore.get(publishProcessesAtom)[0]?.phase).toBe('completed'),
    )
  })

  it('leaves the saved draft unpublished when one AI task fails', async () => {
    vi.mocked(tasks.getTask).mockResolvedValue({
      error: 'provider unavailable',
      id: 'summary-1',
      status: AITaskStatus.Failed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)

    const result = await prepareAndPublishPost({
      data: { categoryId: 'cat-1', text: 'Body', title: 'Post' },
      id: '',
      resources: ['summary'],
    })

    expect(result.isPublished).toBe(false)
    await vi.waitFor(() =>
      expect(jotaiStore.get(publishProcessesAtom)[0]).toMatchObject({
        error: 'provider unavailable',
        phase: 'failed',
      }),
    )
    expect(posts.publishPost).not.toHaveBeenCalled()
  })

  it('uses the same private preparation gate for notes', async () => {
    const result = await prepareAndPublishNote({
      data: { text: 'A note', title: 'Note' },
      id: '',
      resources: ['summary'],
    })

    expect(notes.saveNote).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        isPublished: false,
        skipAiAutoGeneration: true,
      }),
    )
    expect(result.isPublished).toBe(false)
    await vi.waitFor(() =>
      expect(notes.publishNote).toHaveBeenCalledWith('post-1', true, {
        preparedAiResources: ['summary'],
      }),
    )
  })

  it('cancels known AI tasks and never publishes the draft', async () => {
    vi.mocked(tasks.getTask).mockResolvedValue({
      id: 'summary-1',
      status: AITaskStatus.Running,
    } as Awaited<ReturnType<typeof tasks.getTask>>)

    await prepareAndPublishPost({
      data: { categoryId: 'cat-1', text: 'Body', title: 'Post' },
      id: '',
      resources: ['summary'],
    })
    await vi.waitFor(() =>
      expect(
        jotaiStore.get(publishProcessesAtom)[0]?.resources[0]?.taskId,
      ).toBe('summary-1'),
    )

    const processId = jotaiStore.get(publishProcessesAtom)[0]!.id
    await cancelPublishProcess(processId)

    expect(tasks.cancelTask).toHaveBeenCalledWith('summary-1')
    expect(posts.publishPost).not.toHaveBeenCalled()
    expect(jotaiStore.get(publishProcessesAtom)[0]?.phase).toBe('cancelled')
  })
})
