export const TASK_QUEUE_SCHEMA_VERSION = '1'

export const TASK_QUEUE_KEY_PREFIX = 'task-queue'

export const TASK_QUEUE_KEYS = {
  task: (id: string) => `${TASK_QUEUE_KEY_PREFIX}:${id}`,
  logs: (id: string) => `${TASK_QUEUE_KEY_PREFIX}:${id}:logs`,
  pendingQueue: `${TASK_QUEUE_KEY_PREFIX}:queue:pending`,
  processingSet: `${TASK_QUEUE_KEY_PREFIX}:processing`,
  indexAll: `${TASK_QUEUE_KEY_PREFIX}:index:all`,
  indexByStatus: (status: string) =>
    `${TASK_QUEUE_KEY_PREFIX}:index:status:${status}`,
  indexByType: (type: string) => `${TASK_QUEUE_KEY_PREFIX}:index:type:${type}`,
  indexByGroup: (groupId: string) =>
    `${TASK_QUEUE_KEY_PREFIX}:index:group:${groupId}`,
  lock: (id: string) => `${TASK_QUEUE_KEY_PREFIX}:lock:${id}`,
  dedup: (hash: string) => `${TASK_QUEUE_KEY_PREFIX}:dedup:${hash}`,
} as const

/** TTL in seconds */
export const TASK_QUEUE_TTL = {
  taskDefault: 72 * 60 * 60,
  taskCompleted: 24 * 60 * 60,
  lock: 30,
  dedup: 5 * 60,
} as const

/** TTL in milliseconds */
export const TASK_QUEUE_TTL_MS = {
  lock: TASK_QUEUE_TTL.lock * 1000,
  heartbeatInterval: 10 * 1000,
  heartbeatTimeout: 60 * 1000,
} as const

export const TASK_QUEUE_LIMITS = {
  maxLogs: 100,
  maxLogBytes: 500,
  maxResultSize: 64 * 1024,
  largeResultThreshold: 50 * 1024,
  maxRetries: 3,
  maxConcurrency: 10,
  recoveryBatchSize: 10,
  recoveryIntervalMs: 30 * 1000,
  processorPollIntervalMs: 1000,
  cancelCheckIntervalMs: 2000,
} as const
