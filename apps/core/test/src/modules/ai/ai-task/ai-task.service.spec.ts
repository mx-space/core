import { describe, expect, it, vi } from 'vitest'

import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'

function createService() {
  const taskQueueService = {
    createTask: vi.fn(
      async ({ dedupKey }: { dedupKey?: string; type: string }) => ({
        taskId: `task-${dedupKey}`,
        created: true,
      }),
    ),
  }
  const databaseService = {}
  const service = new AiTaskService(
    taskQueueService as any,
    databaseService as any,
  )
  return { service, taskQueueService }
}

describe('AiTaskService.createImageGenerationTask', () => {
  it('creates two distinct task ids for the same prompt when requestId differs', async () => {
    const { service } = createService()

    const first = await service.createImageGenerationTask({
      prompt: 'a cat wearing sunglasses',
      purpose: 'cover',
      requestId: 'req-1',
    })
    const second = await service.createImageGenerationTask({
      prompt: 'a cat wearing sunglasses',
      purpose: 'cover',
      requestId: 'req-2',
    })

    expect(first.taskId).not.toBe(second.taskId)
  })

  it('derives the dedup key from requestId, not from the prompt payload', async () => {
    const { service, taskQueueService } = createService()

    await service.createImageGenerationTask({
      prompt: 'a cat',
      purpose: 'inline',
      requestId: 'req-42',
    })

    expect(taskQueueService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AITaskType.ImageGeneration,
        dedupKey: 'req-42',
      }),
    )
  })
})
