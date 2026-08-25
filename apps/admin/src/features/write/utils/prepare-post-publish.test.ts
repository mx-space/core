import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as ai from '~/api/ai'
import { AITaskStatus } from '~/api/tasks'
import * as tasks from '~/api/tasks'
import * as notes from '~/data/resources/note.mutations'
import * as posts from '~/data/resources/post.mutations'

import {
  prepareAndPublishNote,
  prepareAndPublishPost,
} from './prepare-post-publish'

vi.mock('~/api/ai', () => ({
  createInsightsTask: vi.fn(),
  createSummaryTask: vi.fn(),
  createTranslationTask: vi.fn(),
  createTtsTask: vi.fn(),
}))
vi.mock('~/api/tasks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api/tasks')>()),
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
    vi.mocked(tasks.getTask).mockResolvedValue({
      id: 'task-1',
      status: AITaskStatus.Completed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)
  })

  it('keeps the post private until every selected AI task completes', async () => {
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
    expect(posts.publishPost).toHaveBeenCalledWith('post-1', true, {
      preparedAiResources: ['summary', 'translation'],
    })
    expect(result.isPublished).toBe(true)
  })

  it('leaves the saved draft unpublished when one AI task fails', async () => {
    vi.mocked(tasks.getTask).mockResolvedValue({
      error: 'provider unavailable',
      id: 'summary-1',
      status: AITaskStatus.Failed,
    } as Awaited<ReturnType<typeof tasks.getTask>>)

    await expect(
      prepareAndPublishPost({
        data: { categoryId: 'cat-1', text: 'Body', title: 'Post' },
        id: '',
        resources: ['summary'],
      }),
    ).rejects.toThrow('provider unavailable')

    expect(posts.publishPost).not.toHaveBeenCalled()
  })

  it('uses the same private preparation gate for notes', async () => {
    await prepareAndPublishNote({
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
    expect(notes.publishNote).toHaveBeenCalledWith('post-1', true, {
      preparedAiResources: ['summary'],
    })
  })
})
