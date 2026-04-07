import { describe, expect, it, vi } from 'vitest'

import { AiImageController } from '~/modules/ai/ai-image/ai-image.controller'

describe('AiImageController', () => {
  it('delegates cover task creation to AiTaskService', async () => {
    const createCoverTask = vi.fn().mockResolvedValue({ id: 'task-1' })
    const controller = new AiImageController({
      createCoverTask,
    } as any)
    const payload = {
      refId: 'post-1',
      overwrite: true,
    }

    await expect(controller.createCoverTask(payload as any)).resolves.toEqual({
      id: 'task-1',
    })
    expect(createCoverTask).toHaveBeenCalledWith(payload)
  })
})
