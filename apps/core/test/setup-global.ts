// Mock scheduleManager to prevent background tasks from running after tests
import { vi } from 'vitest'

process.env.TEST ??= '1'
process.env.NODE_ENV ??= 'development'
process.env.MX_ENCRYPT_KEY ??=
  '593f62860255feb0a914534a43814b9809cc7534da7f5485cd2e3d3c8609acab'

vi.mock('~/utils/schedule.util', () => ({
  scheduleManager: {
    batch: vi.fn((callback: () => any) => callback()),
    batchCalls: vi.fn((callback: any) => callback),
    schedule: vi.fn(), // No-op - don't run scheduled tasks in tests
    setNotifyFunction: vi.fn(),
    setBatchNotifyFunction: vi.fn(),
  },
  scheduleMicrotask: vi.fn(),
  createNotifyManager: vi.fn(() => ({
    batch: vi.fn((callback: () => any) => callback()),
    batchCalls: vi.fn((callback: any) => callback),
    schedule: vi.fn(),
    setNotifyFunction: vi.fn(),
    setBatchNotifyFunction: vi.fn(),
  })),
}))
