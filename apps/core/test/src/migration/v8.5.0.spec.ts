import v8_5_0 from '~/migration/version/v8.5.0'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('v8.5.0 AI migration', () => {
  let mockDb: {
    collection: ReturnType<typeof vi.fn>
  }
  let mockFindOne: ReturnType<typeof vi.fn>
  let mockUpdateOne: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFindOne = vi.fn()
    mockUpdateOne = vi.fn()
    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: mockFindOne,
        updateOne: mockUpdateOne,
      }),
    }
  })

  it('should migrate old AI config to new provider format', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        openAiKey: 'sk-test',
        openAiEndpoint: 'https://api.openai.com',
        openAiPreferredModel: 'gpt-4o',
        enableSummary: true,
        enableAutoGenerateSummary: false,
        enableDeepReading: true,
        aiSummaryTargetLanguage: 'zh',
      },
    })

    await v8_5_0(mockDb as any)

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    const updateCall = mockUpdateOne.mock.calls[0]
    expect(updateCall[0]).toEqual({ name: 'ai' })

    const newValue = updateCall[1].$set.value
    expect(newValue.providers).toHaveLength(1)
    expect(newValue.providers[0]).toEqual({
      id: 'default',
      name: 'OpenAI',
      type: 'openai',
      apiKey: 'sk-test',
      endpoint: 'https://api.openai.com',
      defaultModel: 'gpt-4o',
      enabled: true,
    })
    expect(newValue.summaryModel).toEqual({ providerId: 'default' })
    expect(newValue.writerModel).toEqual({ providerId: 'default' })
    expect(newValue.commentReviewModel).toEqual({ providerId: 'default' })
    expect(newValue.enableSummary).toBe(true)
    expect(newValue.aiSummaryTargetLanguage).toBe('zh')
    // Old fields should be removed
    expect(newValue.openAiKey).toBeUndefined()
    expect(newValue.openAiEndpoint).toBeUndefined()
    expect(newValue.openAiPreferredModel).toBeUndefined()
    expect(newValue.enableDeepReading).toBeUndefined()
  })

  it('should skip if already migrated (has providers)', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [{ id: 'existing', enabled: true }],
        enableSummary: true,
      },
    })

    await v8_5_0(mockDb as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should skip if no ai config exists', async () => {
    mockFindOne.mockResolvedValueOnce(null)

    await v8_5_0(mockDb as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should skip if ai config value is empty', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: null,
    })

    await v8_5_0(mockDb as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should handle empty openAiKey (no providers created)', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        openAiKey: '',
        enableSummary: false,
      },
    })

    await v8_5_0(mockDb as any)

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.providers).toEqual([])
    expect(newValue.summaryModel).toBeUndefined()
    expect(newValue.writerModel).toBeUndefined()
    expect(newValue.commentReviewModel).toBeUndefined()
  })

  it('should use default model when openAiPreferredModel is not set', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        openAiKey: 'sk-test',
        enableSummary: true,
      },
    })

    await v8_5_0(mockDb as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.providers[0].defaultModel).toBe('gpt-4o-mini')
  })

  it('should handle undefined endpoint', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        openAiKey: 'sk-test',
        openAiPreferredModel: 'gpt-4o',
        enableSummary: true,
      },
    })

    await v8_5_0(mockDb as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.providers[0].endpoint).toBeUndefined()
  })
})
