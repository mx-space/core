import { beforeEach, describe, expect, it, vi } from 'vitest'

import v10_1_0 from '~/migration/version/v10.1.0'

describe('v10.1.0 AI summary language migration', () => {
  let mockDb: { collection: ReturnType<typeof vi.fn> }
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

  it('should convert aiSummaryTargetLanguage string to summaryTargetLanguages array', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableSummary: true,
        aiSummaryTargetLanguage: 'zh',
      },
    })

    await v10_1_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.summaryTargetLanguages).toEqual(['zh'])
    expect(newValue.aiSummaryTargetLanguage).toBeUndefined()
  })

  it('should convert auto to empty array', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        aiSummaryTargetLanguage: 'auto',
      },
    })

    await v10_1_0.run(mockDb as any, {} as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.summaryTargetLanguages).toEqual([])
  })

  it('should skip if already migrated', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        summaryTargetLanguages: ['en'],
      },
    })

    await v10_1_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should skip if no ai config', async () => {
    mockFindOne.mockResolvedValueOnce(null)

    await v10_1_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should handle missing aiSummaryTargetLanguage field', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableSummary: true,
      },
    })

    await v10_1_0.run(mockDb as any, {} as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.summaryTargetLanguages).toEqual([])
    expect(newValue.aiSummaryTargetLanguage).toBeUndefined()
  })
})
