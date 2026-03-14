import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SlugBackfillTaskPayload } from '~/modules/ai/ai-task/ai-task.types'
import { AiSlugBackfillService } from '~/modules/ai/ai-writer/ai-slug-backfill.service'
import type { TaskExecuteContext, TaskHandler } from '~/processors/task-queue'

describe('AiSlugBackfillService', () => {
  let service: AiSlugBackfillService
  let registeredHandler: TaskHandler<SlugBackfillTaskPayload> | undefined

  const noteModel = {
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    updateOne: vi.fn(),
  }

  const aiWriterService = {
    generateSlugByTitleViaOpenAI: vi.fn(),
  }

  const taskProcessor = {
    registerHandler: vi.fn((handler: TaskHandler<SlugBackfillTaskPayload>) => {
      registeredHandler = handler
    }),
  }

  const aiTaskService = {
    createSlugBackfillTask: vi.fn(),
  }

  const createContext = () => {
    const logs: Array<{ level: string; message: string }> = []
    const context: TaskExecuteContext = {
      taskId: 'task-1',
      signal: new AbortController().signal,
      appendLog: vi.fn(async (level, message) => {
        logs.push({ level, message })
      }),
      updateProgress: vi.fn(async () => undefined),
      incrementTokens: vi.fn(async () => undefined),
      setResult: vi.fn(async () => undefined),
      setStatus: vi.fn(),
      isAborted: vi.fn(() => false),
    }

    return { context, logs }
  }

  beforeEach(() => {
    registeredHandler = undefined
    vi.clearAllMocks()

    noteModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    })
    noteModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
    noteModel.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([{ _id: 'note-1', title: 'First', nid: 1 }]),
    })
    aiWriterService.generateSlugByTitleViaOpenAI.mockResolvedValue({
      slug: 'first',
    })

    service = new AiSlugBackfillService(
      noteModel as any,
      aiWriterService as any,
      taskProcessor as any,
      aiTaskService as any,
    )
    service.onModuleInit()
  })

  it('should log targeted note ids when backfilling specific notes', async () => {
    const { context, logs } = createContext()

    await registeredHandler!.execute({ noteIds: ['note-1', 'note-2'] }, context)

    expect(logs[0]?.message).toContain('note-1, note-2')
  })
})
