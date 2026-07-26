// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { buildImageTools } from './image-tools'

const generateImage = vi.fn()
const waitForImageTask = vi.fn()

vi.mock('~/api/ai-image', () => ({
  generateImage: (...args: unknown[]) => generateImage(...args),
  waitForImageTask: (...args: unknown[]) => waitForImageTask(...args),
}))

describe('buildImageTools', () => {
  it('rejects a missing prompt without calling the API', async () => {
    const [tool] = buildImageTools()
    const result = await tool.execute({})

    expect(result).toEqual({
      error: { error: 'invalid_params', message: expect.any(String) },
      ok: false,
    })
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('generates a fresh requestId per call and returns the image URL', async () => {
    generateImage.mockResolvedValueOnce({ created: true, taskId: 'task-1' })
    waitForImageTask.mockResolvedValueOnce({
      completedAt: 1,
      url: 'https://example.com/a.png',
    })

    const [tool] = buildImageTools({ refId: 'post-1' })
    const result = await tool.execute({ prompt: 'a cat', aspectRatio: '1:1' })

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: '1:1',
        prompt: 'a cat',
        purpose: 'inline',
        refId: 'post-1',
        requestId: expect.any(String),
      }),
    )
    expect(waitForImageTask).toHaveBeenCalledWith('task-1')
    expect(result.ok).toBe(true)
    expect((result as { content: string }).content).toContain(
      'https://example.com/a.png',
    )

    generateImage.mockResolvedValueOnce({ created: true, taskId: 'task-2' })
    waitForImageTask.mockResolvedValueOnce({
      completedAt: 2,
      url: 'https://example.com/b.png',
    })
    await tool.execute({ prompt: 'a dog' })

    const firstRequestId = generateImage.mock.calls[0][0].requestId
    const secondRequestId = generateImage.mock.calls[1][0].requestId
    expect(secondRequestId).not.toBe(firstRequestId)
  })

  it('returns a tool error when generation fails', async () => {
    generateImage.mockRejectedValueOnce(new Error('provider unavailable'))

    const [tool] = buildImageTools()
    const result = await tool.execute({ prompt: 'a cat' })

    expect(result).toEqual({
      error: { error: 'generate_failed', message: 'provider unavailable' },
      ok: false,
    })
  })
})
