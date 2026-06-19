import { vi } from 'vitest'

process.env.TEST ??= '1'
process.env.NODE_ENV ??= 'development'
process.env.MX_ENCRYPT_KEY ??=
  '593f62860255feb0a914534a43814b9809cc7534da7f5485cd2e3d3c8609acab'
process.env.JWT_SECRET ??= 'e2e-jwt-secret-e2e-jwt-secret-123456'
process.env.SNOWFLAKE_WORKER_ID ??= '1'

Object.assign(globalThis, {
  isDev: true,
  cwd: process.cwd(),
  consola: console,
})

// Force synchronous notify-manager batching so tests don't race against real
// microtask scheduling; observable HTTP behaviour is unchanged.
vi.mock('~/utils/schedule.util', () => ({
  scheduleManager: {
    batch: vi.fn((callback: () => unknown) => callback()),
    batchCalls: vi.fn((callback: unknown) => callback),
    schedule: vi.fn(),
    setNotifyFunction: vi.fn(),
    setBatchNotifyFunction: vi.fn(),
  },
  scheduleMicrotask: vi.fn(),
  createNotifyManager: vi.fn(() => ({
    batch: vi.fn((callback: () => unknown) => callback()),
    batchCalls: vi.fn((callback: unknown) => callback),
    schedule: vi.fn(),
    setNotifyFunction: vi.fn(),
    setBatchNotifyFunction: vi.fn(),
  })),
}))
