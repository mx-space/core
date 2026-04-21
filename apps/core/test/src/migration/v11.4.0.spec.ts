import { beforeEach, describe, expect, it, vi } from 'vitest'

import v11_4_0 from '~/migration/version/v11.4.0'

describe('v11.4.0 split ai summary auto generate migration', () => {
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

  it('should split legacy=true into both new flags', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableSummary: true,
        enableAutoGenerateSummary: true,
      },
    })

    await v11_4_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.enableAutoGenerateSummaryOnCreate).toBe(true)
    expect(newValue.enableAutoGenerateSummaryOnUpdate).toBe(true)
    expect(newValue.enableAutoGenerateSummary).toBeUndefined()
    expect(newValue.enableSummary).toBe(true)
  })

  it('should split legacy=false into both new flags as false', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableAutoGenerateSummary: false,
      },
    })

    await v11_4_0.run(mockDb as any, {} as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.enableAutoGenerateSummaryOnCreate).toBe(false)
    expect(newValue.enableAutoGenerateSummaryOnUpdate).toBe(false)
    expect(newValue.enableAutoGenerateSummary).toBeUndefined()
  })

  it('should default to false when legacy field absent', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableSummary: false,
      },
    })

    await v11_4_0.run(mockDb as any, {} as any)

    const newValue = mockUpdateOne.mock.calls[0][1].$set.value
    expect(newValue.enableAutoGenerateSummaryOnCreate).toBe(false)
    expect(newValue.enableAutoGenerateSummaryOnUpdate).toBe(false)
    expect(newValue.enableAutoGenerateSummary).toBeUndefined()
  })

  it('should be idempotent when new fields already present', async () => {
    mockFindOne.mockResolvedValueOnce({
      name: 'ai',
      value: {
        providers: [],
        enableAutoGenerateSummaryOnCreate: true,
        enableAutoGenerateSummaryOnUpdate: false,
      },
    })

    await v11_4_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should skip if no ai config', async () => {
    mockFindOne.mockResolvedValueOnce(null)

    await v11_4_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('should skip if ai config value is empty', async () => {
    mockFindOne.mockResolvedValueOnce({ name: 'ai', value: null })

    await v11_4_0.run(mockDb as any, {} as any)

    expect(mockUpdateOne).not.toHaveBeenCalled()
  })
})
