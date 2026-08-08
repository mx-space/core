import { vi } from 'vitest'

export function createAiGenerationMetricsMock() {
  return {
    attachLatest: vi.fn(async (_type: string, items: unknown[]) =>
      items.map((item) => ({
        ...(item as object),
        generationMetrics: null,
      })),
    ),
    deleteByResource: vi.fn().mockResolvedValue(undefined),
    record: vi.fn().mockResolvedValue(undefined),
  }
}
