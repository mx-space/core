import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { getRedisKey } from '~/utils/redis.util'
import { md5 } from '~/utils/tool.util'
import { RedisService } from '../redis/redis.service'
import {
  TASK_QUEUE_KEYS,
  TASK_QUEUE_LIMITS,
  TASK_QUEUE_SCHEMA_VERSION,
  TASK_QUEUE_TTL,
  TASK_QUEUE_TTL_MS,
} from './task-queue.constants'
import {
  LUA_ACQUIRE_TASK,
  LUA_CANCEL_PENDING,
  LUA_RECOVER_STALE,
  LUA_UPDATE_STATUS,
} from './task-queue.lua'
import {
  parseTask,
  TaskStatus,
  type SubTaskStats,
  type Task,
  type TaskRedis,
} from './task-queue.types'

const BATCH_TASK_TYPES = ['ai:translation:batch', 'ai:translation:all']

type LogLevel = 'info' | 'warn' | 'error'

export interface CreateTaskOptions {
  type: string
  payload: Record<string, unknown>
  dedupKey?: string
  groupId?: string
}

@Injectable()
export class TaskQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name)

  constructor(private readonly redisService: RedisService) {}

  async onModuleDestroy() {}

  private get redis() {
    return this.redisService.getClient()
  }

  private getKey(key: string) {
    return getRedisKey(key as any)
  }

  private computeDedupHash(type: string, dedupKey?: string): string {
    if (dedupKey) {
      return md5(`${TASK_QUEUE_SCHEMA_VERSION}:${type}:${dedupKey}`)
    }
    return md5(
      `${TASK_QUEUE_SCHEMA_VERSION}:${type}:${Date.now()}:${Math.random()}`,
    )
  }

  async createTask(
    options: CreateTaskOptions,
  ): Promise<{ taskId: string; created: boolean }> {
    const { type, payload, dedupKey, groupId } = options
    const payloadHash = this.computeDedupHash(type, dedupKey)

    if (dedupKey) {
      const dedupRedisKey = this.getKey(TASK_QUEUE_KEYS.dedup(payloadHash))
      const existingTaskId = await this.redis.get(dedupRedisKey)

      if (existingTaskId) {
        const existingTask = await this.getTask(existingTaskId)
        if (
          existingTask &&
          (existingTask.status === TaskStatus.Pending ||
            existingTask.status === TaskStatus.Running)
        ) {
          return { taskId: existingTaskId, created: false }
        }
      }
    }

    const taskId = this.generateTaskId()
    const now = Date.now()

    const taskData: TaskRedis = {
      id: taskId,
      type,
      status: TaskStatus.Pending,
      payload: JSON.stringify(payload),
      payloadHash,
      groupId: groupId || '',
      progress: '',
      progressMessage: '',
      totalItems: '',
      completedItems: '',
      tokensGenerated: '0',
      createdAt: String(now),
      startedAt: '',
      completedAt: '',
      lastHeartbeat: String(now),
      result: '',
      error: '',
      workerId: '',
      retryCount: '0',
      version: TASK_QUEUE_SCHEMA_VERSION,
    }

    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const pendingQueue = this.getKey(TASK_QUEUE_KEYS.pendingQueue)
    const indexAll = this.getKey(TASK_QUEUE_KEYS.indexAll)
    const indexPending = this.getKey(
      TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Pending),
    )
    const indexType = this.getKey(TASK_QUEUE_KEYS.indexByType(type))

    const pipeline = this.redis.pipeline()
    pipeline.hset(taskKey, taskData as unknown as Record<string, string>)
    pipeline.expire(taskKey, TASK_QUEUE_TTL.taskDefault)
    pipeline.rpush(pendingQueue, taskId)
    pipeline.zadd(indexAll, now, taskId)
    pipeline.zadd(indexPending, now, taskId)
    pipeline.zadd(indexType, now, taskId)

    if (groupId) {
      const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(groupId))
      pipeline.zadd(indexGroup, now, taskId)
      pipeline.expire(indexGroup, TASK_QUEUE_TTL.taskDefault)
    }

    if (dedupKey) {
      const dedupRedisKey = this.getKey(TASK_QUEUE_KEYS.dedup(payloadHash))
      pipeline.set(dedupRedisKey, taskId, 'EX', TASK_QUEUE_TTL.dedup)
    }

    await pipeline.exec()

    this.logger.log(
      `Task created: id=${taskId} type=${type}${groupId ? ` group=${groupId}` : ''}`,
    )
    return { taskId, created: true }
  }

  async getTask(taskId: string): Promise<Task | null> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))

    const [rawTask, logs] = await Promise.all([
      this.redis.hgetall(taskKey),
      this.redis.lrange(logsKey, 0, -1),
    ])

    if (!rawTask || !rawTask.id) {
      return null
    }

    const task = parseTask(rawTask as unknown as TaskRedis, logs)

    // For batch tasks, compute sub-task statistics
    if (BATCH_TASK_TYPES.includes(task.type)) {
      task.subTaskStats = await this.computeSubTaskStats(taskId)
    }

    return task
  }

  private async computeSubTaskStats(
    groupId: string,
  ): Promise<SubTaskStats | undefined> {
    const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(groupId))
    const taskIds = await this.redis.zrange(indexGroup, 0, -1)

    if (!taskIds.length) {
      return undefined
    }

    const stats: SubTaskStats = {
      total: taskIds.length,
      completed: 0,
      partialFailed: 0,
      failed: 0,
      running: 0,
      pending: 0,
    }

    // Batch fetch all task statuses
    const pipeline = this.redis.pipeline()
    for (const id of taskIds) {
      const taskKey = this.getKey(TASK_QUEUE_KEYS.task(id))
      pipeline.hget(taskKey, 'status')
    }

    const results = await pipeline.exec()
    if (!results) return stats

    for (const [err, status] of results) {
      if (err || !status) continue
      switch (status as string) {
        case TaskStatus.Completed:
          stats.completed++
          break
        case TaskStatus.PartialFailed:
          stats.partialFailed++
          break
        case TaskStatus.Failed:
          stats.failed++
          break
        case TaskStatus.Running:
          stats.running++
          break
        case TaskStatus.Pending:
          stats.pending++
          break
        case TaskStatus.Cancelled:
          stats.failed++ // Count cancelled as failed for simplicity
          break
      }
    }

    return stats
  }

  async getTasks(options: {
    status?: TaskStatus
    type?: string
    page: number
    size: number
    includeSubTasks?: boolean
  }): Promise<{ data: Task[]; total: number }> {
    const { status, type, page, size, includeSubTasks = false } = options

    let indexKey: string
    if (type) {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexByType(type))
    } else if (status) {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexByStatus(status))
    } else {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexAll)
    }

    // Get all task IDs from the index first, then filter
    const allTaskIds = await this.redis.zrevrange(indexKey, 0, -1)

    if (!allTaskIds.length) {
      return { data: [], total: 0 }
    }

    // Fetch all tasks to filter sub-tasks
    const allTasks = await Promise.all(allTaskIds.map((id) => this.getTask(id)))
    let filteredTasks = allTasks.filter((t): t is Task => t !== null)

    // Filter by status if both type and status are specified
    if (type && status) {
      filteredTasks = filteredTasks.filter((t) => t.status === status)
    }

    // Exclude sub-tasks (tasks with groupId) unless explicitly included
    if (!includeSubTasks) {
      filteredTasks = filteredTasks.filter((t) => !t.groupId)
    }

    const total = filteredTasks.length
    const start = (page - 1) * size
    const paginatedTasks = filteredTasks.slice(start, start + size)

    return { data: paginatedTasks, total }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }

    if (
      task.status === TaskStatus.Completed ||
      task.status === TaskStatus.PartialFailed ||
      task.status === TaskStatus.Failed ||
      task.status === TaskStatus.Cancelled
    ) {
      throw new BizException(ErrorCodeEnum.AITaskAlreadyCompleted)
    }

    if (task.status === TaskStatus.Pending) {
      const result = await this.redis.eval(
        LUA_CANCEL_PENDING,
        4,
        this.getKey(TASK_QUEUE_KEYS.task(taskId)),
        this.getKey(TASK_QUEUE_KEYS.pendingQueue),
        this.getKey(TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Pending)),
        this.getKey(TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Cancelled)),
        taskId,
        String(Date.now()),
      )
      if (result === 1) {
        await this.appendLog(taskId, 'info', 'Task cancelled by user')
        this.logger.log(`Task cancelled (pending): id=${taskId}`)
        return true
      }
    }

    if (task.status === TaskStatus.Running) {
      await this.updateStatus(taskId, TaskStatus.Cancelled, {
        completedAt: String(Date.now()),
      })
      await this.appendLog(taskId, 'info', 'Task cancel requested')
      this.logger.log(`Task cancel requested (running): id=${taskId}`)
      return true
    }

    return false
  }

  async cancelTasksByGroupId(groupId: string): Promise<number> {
    const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(groupId))
    const taskIds = await this.redis.zrange(indexGroup, 0, -1)

    if (!taskIds.length) {
      return 0
    }

    let cancelled = 0
    for (const taskId of taskIds) {
      try {
        const success = await this.cancelTask(taskId)
        if (success) {
          cancelled++
        }
      } catch {
        // Task may already be completed or not exist
      }
    }

    this.logger.log(
      `Tasks cancelled by group: groupId=${groupId} cancelled=${cancelled}/${taskIds.length}`,
    )
    return cancelled
  }

  async getTasksByGroupId(groupId: string): Promise<Task[]> {
    const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(groupId))
    const taskIds = await this.redis.zrevrange(indexGroup, 0, -1)

    if (!taskIds.length) {
      return []
    }

    const tasks = await Promise.all(taskIds.map((id) => this.getTask(id)))
    return tasks.filter((t): t is Task => t !== null)
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new BizException(ErrorCodeEnum.AITaskNotFound)
    }

    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))
    const lockKey = this.getKey(TASK_QUEUE_KEYS.lock(taskId))
    const indexAll = this.getKey(TASK_QUEUE_KEYS.indexAll)
    const indexStatus = this.getKey(TASK_QUEUE_KEYS.indexByStatus(task.status))
    const indexType = this.getKey(TASK_QUEUE_KEYS.indexByType(task.type))
    const processingSet = this.getKey(TASK_QUEUE_KEYS.processingSet)

    const pipeline = this.redis.pipeline()
    pipeline.del(taskKey)
    pipeline.del(logsKey)
    pipeline.del(lockKey)
    pipeline.zrem(indexAll, taskId)
    pipeline.zrem(indexStatus, taskId)
    pipeline.zrem(indexType, taskId)
    // Always remove from processing set to prevent recovery from recreating deleted tasks
    pipeline.zrem(processingSet, taskId)

    if (task.groupId) {
      const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(task.groupId))
      pipeline.zrem(indexGroup, taskId)
    }

    await pipeline.exec()

    this.logger.log(`Task deleted: id=${taskId}`)
  }

  async deleteTasks(options: {
    status?: TaskStatus
    type?: string
    before: number
  }): Promise<number> {
    const { status, type, before } = options

    if (before >= Date.now()) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'before must be in the past',
      )
    }

    let indexKey: string
    if (type) {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexByType(type))
    } else if (status) {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexByStatus(status))
    } else {
      indexKey = this.getKey(TASK_QUEUE_KEYS.indexAll)
    }

    const taskIds = await this.redis.zrangebyscore(indexKey, '-inf', before)

    if (!taskIds.length) {
      return 0
    }

    let deleted = 0
    for (const taskId of taskIds) {
      try {
        const task = await this.getTask(taskId)
        if (
          task &&
          (task.status === TaskStatus.Completed ||
            task.status === TaskStatus.PartialFailed ||
            task.status === TaskStatus.Failed ||
            task.status === TaskStatus.Cancelled)
        ) {
          await this.deleteTask(taskId)
          deleted++
        }
      } catch {
        // ignore
      }
    }

    this.logger.log(`Batch delete completed: deleted=${deleted}`)
    return deleted
  }

  async acquireTask(workerId: string): Promise<string | null> {
    const result = await this.redis.eval(
      LUA_ACQUIRE_TASK,
      2,
      this.getKey(TASK_QUEUE_KEYS.pendingQueue),
      this.getKey(TASK_QUEUE_KEYS.processingSet),
      workerId,
      String(TASK_QUEUE_TTL_MS.lock),
      String(Date.now()),
      this.getKey(TASK_QUEUE_KEYS.lock('')),
      this.getKey(TASK_QUEUE_KEYS.task('')),
    )

    if (result) {
      const taskId = result as string
      const indexPending = this.getKey(
        TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Pending),
      )
      const indexRunning = this.getKey(
        TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Running),
      )
      const task = await this.getTask(taskId)
      if (task) {
        await this.redis.zrem(indexPending, taskId)
        await this.redis.zadd(indexRunning, task.createdAt, taskId)
      }
      this.logger.debug(`Task acquired: id=${taskId} worker=${workerId}`)
      return taskId
    }

    return null
  }

  async renewLock(taskId: string, workerId: string): Promise<boolean> {
    const lockKey = this.getKey(TASK_QUEUE_KEYS.lock(taskId))
    const currentHolder = await this.redis.get(lockKey)

    if (currentHolder !== workerId) {
      return false
    }

    await this.redis.pexpire(lockKey, TASK_QUEUE_TTL_MS.lock)
    await this.updateHeartbeat(taskId)
    return true
  }

  async releaseLock(taskId: string): Promise<void> {
    const lockKey = this.getKey(TASK_QUEUE_KEYS.lock(taskId))
    await this.redis.del(lockKey)
  }

  async updateHeartbeat(taskId: string): Promise<void> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const processingSet = this.getKey(TASK_QUEUE_KEYS.processingSet)
    const now = Date.now()

    await this.redis.hset(taskKey, 'lastHeartbeat', String(now))
    await this.redis.zadd(processingSet, now, taskId)
  }

  async updateProgress(
    taskId: string,
    progress: number,
    message?: string,
    completed?: number,
    total?: number,
  ): Promise<void> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const updates: Record<string, string> = {
      progress: String(progress),
      lastHeartbeat: String(Date.now()),
    }

    if (message !== undefined) {
      updates.progressMessage = message
    }
    if (completed !== undefined) {
      updates.completedItems = String(completed)
    }
    if (total !== undefined) {
      updates.totalItems = String(total)
    }

    await this.redis.hset(taskKey, updates)
  }

  async incrementTokens(taskId: string, count: number = 1): Promise<void> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const currentValue = await this.redis.hget(taskKey, 'tokensGenerated')
    if (
      currentValue === null ||
      currentValue === '' ||
      Number.isNaN(Number(currentValue))
    ) {
      await this.redis.hset(taskKey, 'tokensGenerated', '0')
    }
    await this.redis.hincrby(taskKey, 'tokensGenerated', count)
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    extra?: Record<string, string>,
  ): Promise<void> {
    // Check if task exists to prevent "reviving" deleted tasks
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const exists = await this.redis.exists(taskKey)
    if (!exists) return

    const processingSet = this.getKey(TASK_QUEUE_KEYS.processingSet)
    // Pass the status index prefix so Lua can build correct keys based on actual oldStatus
    // getKey(indexByStatus('')) returns full Redis key like "mx:task-queue:index:status:" ending with ':'
    const statusIndexPrefix = this.getKey(TASK_QUEUE_KEYS.indexByStatus(''))

    const extraArgs = extra ? Object.entries(extra).flat() : []

    await this.redis.eval(
      LUA_UPDATE_STATUS,
      2,
      taskKey,
      processingSet,
      taskId,
      status,
      String(Date.now()),
      statusIndexPrefix,
      ...extraArgs,
    )

    if (
      status === TaskStatus.Completed ||
      status === TaskStatus.PartialFailed ||
      status === TaskStatus.Failed ||
      status === TaskStatus.Cancelled
    ) {
      const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))
      await this.redis.expire(taskKey, TASK_QUEUE_TTL.taskCompleted)
      await this.redis.expire(logsKey, TASK_QUEUE_TTL.taskCompleted)
    }
  }

  async setResult(taskId: string, result: unknown): Promise<void> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    let json = JSON.stringify(result)
    const originalSize = json.length

    if (originalSize > TASK_QUEUE_LIMITS.maxResultSize) {
      if (result && typeof result === 'object' && 'items' in result) {
        const summary = {
          _truncated: true,
          totalCount: (result as { items?: unknown[] }).items?.length || 0,
        }
        json = JSON.stringify(summary)
      } else {
        json = JSON.stringify({ _truncated: true, message: 'Result too large' })
      }

      await this.appendLog(
        taskId,
        'warn',
        `Result truncated, original size: ${originalSize} bytes`,
      )
    }

    await this.redis.hset(taskKey, 'result', json)
  }

  async appendLog(
    taskId: string,
    level: LogLevel,
    message: string,
  ): Promise<void> {
    const encoder = new TextEncoder()
    let bytes = encoder.encode(message)

    if (bytes.length > TASK_QUEUE_LIMITS.maxLogBytes) {
      bytes = bytes.slice(0, TASK_QUEUE_LIMITS.maxLogBytes - 3)
      message = `${new TextDecoder().decode(bytes)}...`
    }

    const log = JSON.stringify({
      timestamp: Date.now(),
      level,
      message,
    })

    const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))
    await this.redis.rpush(logsKey, log)
    await this.redis.ltrim(logsKey, -TASK_QUEUE_LIMITS.maxLogs, -1)
  }

  async recoverStaleTasks(): Promise<number> {
    const threshold = Date.now() - TASK_QUEUE_TTL_MS.heartbeatTimeout

    const result = await this.redis.eval(
      LUA_RECOVER_STALE,
      2,
      this.getKey(TASK_QUEUE_KEYS.processingSet),
      this.getKey(TASK_QUEUE_KEYS.pendingQueue),
      String(threshold),
      String(TASK_QUEUE_LIMITS.maxRetries),
      String(Date.now()),
      String(TASK_QUEUE_LIMITS.recoveryBatchSize),
      this.getKey(TASK_QUEUE_KEYS.lock('')),
      this.getKey(TASK_QUEUE_KEYS.task('')),
      this.getKey(TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Pending)),
      this.getKey(TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Failed)),
      this.getKey(TASK_QUEUE_KEYS.indexByStatus(TaskStatus.Running)),
    )

    const recovered = result as number
    if (recovered > 0) {
      this.logger.log(`Recovered ${recovered} stale tasks`)
    }

    return recovered
  }

  async isTaskCancelled(taskId: string): Promise<boolean> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const status = await this.redis.hget(taskKey, 'status')
    return status === TaskStatus.Cancelled
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `${timestamp}-${random}`
  }
}
