import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
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
import { TaskQueueEmitter } from './task-queue.emitter'
import {
  LUA_ACQUIRE_TASK,
  LUA_CANCEL_PENDING,
  LUA_RECOVER_STALE,
  LUA_UPDATE_STATUS,
} from './task-queue.lua'
import { TaskQueueProcessor } from './task-queue.processor'
import {
  parseTask,
  type SubTaskStats,
  type Task,
  type TaskLog,
  type TaskRedis,
  TaskStatus,
} from './task-queue.types'

const BATCH_TASK_TYPES = ['ai:translation:batch', 'ai:translation:all']
const TASK_LIST_SCAN_BATCH_SIZE = 200

const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.Completed,
  TaskStatus.PartialFailed,
  TaskStatus.Failed,
  TaskStatus.Cancelled,
])

type LogLevel = 'info' | 'warn' | 'error'

function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/**
 * Dual-shape handler for LUA_RECOVER_STALE return values.
 *
 * The script returns an array whose index 0 holds the integer count of
 * recovered tasks and indexes 1+ hold the recovered task ids. This helper
 * tolerates legacy/empty responses (anything non-array → count 0, ids []).
 */
export function parseRecoverStaleResult(result: unknown): {
  count: number
  ids: string[]
} {
  const arr = Array.isArray(result) ? result : []
  const count = arr.length > 0 ? Number(arr[0]) || 0 : 0
  const ids = arr.slice(1).map(String)
  return { count, ids }
}

export interface CreateTaskOptions {
  type: string
  payload: Record<string, unknown>
  dedupKey?: string
  groupId?: string
  scope?: string
}

@Injectable()
export class TaskQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name)

  constructor(
    private readonly redisService: RedisService,
    private readonly emitter: TaskQueueEmitter,
    @Inject(forwardRef(() => TaskQueueProcessor))
    private readonly processor: TaskQueueProcessor,
  ) {}

  async onModuleDestroy() {}

  private get redis() {
    return this.redisService.getClient()
  }

  isRedisReady() {
    return this.redisService.isReady()
  }

  getRedisStatus() {
    return this.redisService.getStatus()
  }

  isRedisUnavailableError(error: unknown) {
    return this.redisService.isUnavailableError(error)
  }

  private getKey(key: string) {
    return getRedisKey(key as any)
  }

  private pickIndexKeyByOption(opts: {
    type?: string
    scope?: string
    status?: TaskStatus
  }): string {
    if (opts.type) {
      return this.getKey(TASK_QUEUE_KEYS.indexByType(opts.type))
    }
    if (opts.scope) {
      return this.getKey(TASK_QUEUE_KEYS.indexByScope(opts.scope))
    }
    if (opts.status) {
      return this.getKey(TASK_QUEUE_KEYS.indexByStatus(opts.status))
    }
    return this.getKey(TASK_QUEUE_KEYS.indexAll)
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
    const { type, payload, dedupKey, groupId, scope } = options
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
      scope: scope || '',
      progress: '',
      progressMessage: '',
      totalItems: '',
      completedItems: '',
      tokensGenerated: '0',
      totalCost: '0',
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

    if (scope) {
      const indexScope = this.getKey(TASK_QUEUE_KEYS.indexByScope(scope))
      pipeline.zadd(indexScope, now, taskId)
    }

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

    const snapshot = parseTask(taskData, [])
    this.emitter.emitCreated(snapshot)

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

    return this.tallyStatuses(taskIds)
  }

  /**
   * Tally child task statuses with one pipelined HGET per id. Cancelled
   * rolls into `failed` for simplicity.
   */
  private async tallyStatuses(taskIds: string[]): Promise<SubTaskStats> {
    const stats: SubTaskStats = {
      total: taskIds.length,
      completed: 0,
      partialFailed: 0,
      failed: 0,
      running: 0,
      pending: 0,
    }
    if (!taskIds.length) return stats

    const pipeline = this.redis.pipeline()
    for (const id of taskIds) {
      pipeline.hget(this.getKey(TASK_QUEUE_KEYS.task(id)), 'status')
    }
    const results = await pipeline.exec()
    if (!results) return stats

    for (const [err, status] of results) {
      if (err || !status) continue
      switch (status as string) {
        case TaskStatus.Completed: {
          stats.completed++
          break
        }
        case TaskStatus.PartialFailed: {
          stats.partialFailed++
          break
        }
        case TaskStatus.Failed: {
          stats.failed++
          break
        }
        case TaskStatus.Running: {
          stats.running++
          break
        }
        case TaskStatus.Pending: {
          stats.pending++
          break
        }
        case TaskStatus.Cancelled: {
          stats.failed++
          break
        }
      }
    }

    return stats
  }

  /**
   * Recompute a parent group's subTaskStats from the live child hashes.
   *
   * - Reads the group ZSET once, then one pipelined HGET per child (status
   *   field only). No N+1 across services — a 100-child group costs 1 ZRANGE
   *   + 1 pipeline RTT.
   * - Returns the FULL stats object (not a delta), so the admin can do a
   *   wholesale replace and last-writer-wins is correct.
   * - Cancelled rolls into `failed` to mirror existing `computeSubTaskStats`
   *   semantics — keeping admin numerics consistent across REST + socket.
   */
  async recomputeGroupStats(groupId: string): Promise<SubTaskStats> {
    const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(groupId))
    const taskIds = await this.redis.zrange(indexGroup, 0, -1)
    return this.tallyStatuses(taskIds)
  }

  async getTasks(options: {
    status?: TaskStatus | TaskStatus[]
    type?: string
    scope?: string
    page: number
    size: number
    includeSubTasks?: boolean
  }): Promise<{ data: Task[]; total: number }> {
    const { status, type, scope, page, size, includeSubTasks = false } = options

    const statuses = Array.isArray(status) ? status : status ? [status] : []
    const singleStatus = statuses.length === 1 ? statuses[0] : undefined

    const indexKey = this.pickIndexKeyByOption({
      type,
      scope,
      status: singleStatus,
    })

    const start = (page - 1) * size
    const pageTaskIds: string[] = []
    let total = 0
    let offset = 0
    const statusSet = new Set(statuses)
    const statusAlreadyIndexed =
      !!singleStatus &&
      indexKey === this.getKey(TASK_QUEUE_KEYS.indexByStatus(singleStatus))
    const scopeAlreadyIndexed =
      !!scope && indexKey === this.getKey(TASK_QUEUE_KEYS.indexByScope(scope))

    while (true) {
      const taskIds = await this.redis.zrevrange(
        indexKey,
        offset,
        offset + TASK_LIST_SCAN_BATCH_SIZE - 1,
      )
      if (!taskIds.length) break

      const pipeline = this.redis.pipeline()
      for (const taskId of taskIds) {
        pipeline.hmget(
          this.getKey(TASK_QUEUE_KEYS.task(taskId)),
          'status',
          'scope',
          'groupId',
        )
      }
      const rows = await pipeline.exec()

      for (let i = 0; i < taskIds.length; i++) {
        const row = rows?.[i]
        if (!row || row[0]) continue
        const [taskStatus, taskScope, groupId] = row[1] as [
          string | null,
          string | null,
          string | null,
        ]
        if (!taskStatus) continue
        if (
          statusSet.size > 0 &&
          !statusAlreadyIndexed &&
          !statusSet.has(taskStatus as TaskStatus)
        ) {
          continue
        }
        if (scope && !scopeAlreadyIndexed && taskScope !== scope) continue
        if (!includeSubTasks && groupId) continue

        if (total >= start && pageTaskIds.length < size) {
          pageTaskIds.push(taskIds[i])
        }
        total++
      }

      offset += taskIds.length
      if (taskIds.length < TASK_LIST_SCAN_BATCH_SIZE) break
    }

    const paginatedTasks = (
      await Promise.all(pageTaskIds.map((id) => this.getTask(id)))
    ).filter((t): t is Task => t !== null)

    return { data: paginatedTasks, total }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw createAppException(AppErrorCode.TASK_NOT_FOUND, { id: taskId })
    }

    if (isTerminalStatus(task.status)) {
      throw createAppException(AppErrorCode.TASK_ALREADY_COMPLETED)
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
        this.emitter.emitStatus(
          {
            id: taskId,
            type: task.type,
            scope: task.scope ?? '',
            groupId: task.groupId,
          },
          { status: TaskStatus.Cancelled },
        )
        this.emitter.dispose(taskId)
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

    // Failures are ignored: a task may already be completed or not exist
    const results = await Promise.allSettled(
      taskIds.map((taskId) => this.cancelTask(taskId)),
    )
    const cancelled = results.filter(
      (r) => r.status === 'fulfilled' && r.value,
    ).length

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

  async retryTask(
    taskId: string,
  ): Promise<{ taskId: string; created: boolean }> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw createAppException(AppErrorCode.TASK_NOT_FOUND, { id: taskId })
    }

    if (
      task.status !== TaskStatus.Failed &&
      task.status !== TaskStatus.PartialFailed &&
      task.status !== TaskStatus.Cancelled
    ) {
      throw createAppException(AppErrorCode.TASK_CANNOT_RETRY, {
        reason:
          'Only failed, partial_failed, or cancelled tasks can be retried',
      })
    }

    const buildRetryTask = this.processor.getRetryBuilder(task.type)
    if (buildRetryTask) {
      const options = await buildRetryTask(task)
      return this.createTask({ ...options, scope: options.scope ?? task.scope })
    }

    return this.createTask({
      type: task.type,
      payload: task.payload as Record<string, unknown>,
      groupId: task.groupId,
      scope: task.scope,
      dedupKey: `${task.type}:retry:${Date.now()}`,
    })
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw createAppException(AppErrorCode.TASK_NOT_FOUND, { id: taskId })
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

    if (task.scope) {
      const indexScope = this.getKey(TASK_QUEUE_KEYS.indexByScope(task.scope))
      pipeline.zrem(indexScope, taskId)
    }

    if (task.groupId) {
      const indexGroup = this.getKey(TASK_QUEUE_KEYS.indexByGroup(task.groupId))
      pipeline.zrem(indexGroup, taskId)
    }

    await pipeline.exec()

    this.logger.log(`Task deleted: id=${taskId}`)

    this.emitter.emitDeleted({
      id: taskId,
      type: task.type,
      scope: task.scope ?? '',
      groupId: task.groupId,
    })
    this.emitter.dispose(taskId)
  }

  async deleteTasks(options: {
    status?: TaskStatus
    type?: string
    scope?: string
    before: number
  }): Promise<number> {
    const { status, type, scope, before } = options

    if (before >= Date.now()) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'before must be in the past',
      })
    }

    const indexKey = this.pickIndexKeyByOption({ type, scope, status })

    const taskIds = await this.redis.zrangebyscore(indexKey, '-inf', before)

    if (!taskIds.length) {
      return 0
    }

    let deleted = 0
    for (const taskId of taskIds) {
      try {
        const task = await this.getTask(taskId)
        if (!task) continue
        if (scope && task.scope !== scope) continue
        if (!isTerminalStatus(task.status)) continue
        if (status && task.status !== status) continue
        await this.deleteTask(taskId)
        deleted++
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
        this.emitter.emitStarted(
          {
            id: task.id,
            type: task.type,
            scope: task.scope ?? '',
            groupId: task.groupId,
          },
          {
            status: TaskStatus.Running,
            workerId: task.workerId,
            startedAt: task.startedAt,
          },
        )
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

    const meta = await this.getEmitMeta(taskId)
    if (meta) {
      const patch: Partial<Task> = { progress }
      if (message !== undefined) patch.progressMessage = message
      if (completed !== undefined) patch.completedItems = completed
      if (total !== undefined) patch.totalItems = total
      // Surface running totalCost so admins see live spend ticking up while a
      // task is in flight. Skipped when the field is absent (pre-spec-2 hash)
      // or zero — keeps the wire patch minimal.
      const cost = await this.readTotalCostUsd(taskId)
      if (cost !== undefined) patch.totalCost = cost
      this.emitter.emitProgress(meta, patch)
    }
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

  /**
   * Accumulate cost into the task hash as integer cents.
   *
   * - Storage precision: 2 decimal places (USD cents) via HINCRBY — sufficient
   *   for billing display. pi-runtime adapter returns USD as a float; if pi
   *   ever switches to micro-dollars or sub-cent units, revisit the MappedUsage
   *   mapping in pi-runtime.adapter.ts before changing the wire format here.
   * - HINCRBY auto-creates the `totalCost` field on pre-spec-2 task hashes,
   *   so callers do not need to seed it.
   * - No-op for non-positive / non-finite input so duplicate calls or
   *   cache-hydrate paths cannot pollute the field.
   */
  async incrementCost(taskId: string, usd: number): Promise<void> {
    if (!(Number.isFinite(usd) && usd > 0)) return
    const cents = Math.round(usd * 100)
    if (cents <= 0) return
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    await this.redis.hincrby(taskKey, 'totalCost', cents)
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

    if (isTerminalStatus(status)) {
      const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))
      await this.redis.expire(taskKey, TASK_QUEUE_TTL.taskCompleted)
      await this.redis.expire(logsKey, TASK_QUEUE_TTL.taskCompleted)
    }

    // Emit lifecycle update — refetch the task once for an accurate patch and
    // for the terminal 'result' decision. Skip emit silently if the task
    // vanished mid-update (e.g. concurrent delete).
    const fresh = await this.getTask(taskId)
    if (!fresh) return
    const meta = {
      id: fresh.id,
      type: fresh.type,
      scope: fresh.scope ?? '',
      groupId: fresh.groupId,
    }
    const statusPatch: Partial<Task> = {
      status: fresh.status,
      progress: fresh.progress,
      progressMessage: fresh.progressMessage,
      completedAt: fresh.completedAt,
      error: fresh.error,
    }
    // Forward totalCost only when present (pre-spec-2 hashes lack it; zero is
    // treated as "no spend yet" and elided to keep the wire patch small).
    if (fresh.totalCost !== undefined) statusPatch.totalCost = fresh.totalCost
    this.emitter.emitStatus(meta, statusPatch)

    if (!isTerminalStatus(status)) {
      // Non-terminal status changes (e.g. Running re-emit) — no child→parent
      // recompute, no throttle cleanup yet.
      return
    }

    // Always release throttle state when a task reaches a terminal status.
    this.emitter.dispose(taskId)

    const shouldEmitResult =
      (status === TaskStatus.Completed ||
        status === TaskStatus.PartialFailed) &&
      fresh.result !== undefined &&
      fresh.result !== null
    if (shouldEmitResult) {
      this.emitter.emitResult(meta, statusPatch, fresh.result)
    } else if (
      status === TaskStatus.Completed &&
      (fresh.result === undefined || fresh.result === null)
    ) {
      this.logger.warn(
        `Terminal Completed without setResult: id=${taskId} type=${fresh.type}`,
      )
    }

    // Child terminal transition triggers a parent subTaskStats recompute so the
    // admin can wholesale-replace its `Partial<Task>.subTaskStats` cache (last-
    // writer-wins is correct because the recompute produces a full snapshot,
    // never a delta). SCOPE LIMIT: we DO NOT mutate the parent status here —
    // the Running → Completed/PartialFailed/Failed transition stays with the
    // batch/all executor by design (spec 2 step-19).
    if (fresh.groupId) {
      await this.emitParentStatsRecompute(fresh.groupId)
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

    const logEntry: TaskLog = {
      timestamp: Date.now(),
      level,
      message,
    }
    const log = JSON.stringify(logEntry)

    const logsKey = this.getKey(TASK_QUEUE_KEYS.logs(taskId))
    await this.redis.rpush(logsKey, log)
    await this.redis.ltrim(logsKey, -TASK_QUEUE_LIMITS.maxLogs, -1)

    const meta = await this.getEmitMeta(taskId)
    if (meta) {
      this.emitter.emitLog(meta, logEntry)
    }
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

    const { count, ids } = parseRecoverStaleResult(result)
    if (count > 0) {
      this.logger.log(`Recovered ${count} stale tasks`)
    }

    // Per-task emits for recovered ids — fan out a 'status' phase with the
    // post-recovery Pending state + incremented retryCount so admin clients
    // re-hydrate the row without waiting for the next polling cycle. Drop
    // any leftover throttle state in case the previous Running incarnation
    // left a pending progress timer dangling.
    for (const id of ids) {
      this.emitter.dispose(id)
      const taskKey = this.getKey(TASK_QUEUE_KEYS.task(id))
      const [type, scope, groupId, retryCountRaw] = await this.redis.hmget(
        taskKey,
        'type',
        'scope',
        'groupId',
        'retryCount',
      )
      if (!type) continue
      this.emitter.emitStatus(
        { id, type, scope: scope || '', groupId: groupId || undefined },
        {
          status: TaskStatus.Pending,
          retryCount: Number(retryCountRaw || '0'),
        },
      )
    }

    return count
  }

  async isTaskCancelled(taskId: string): Promise<boolean> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const status = await this.redis.hget(taskKey, 'status')
    return status === TaskStatus.Cancelled
  }

  /**
   * Read the parent task's emit meta + recomputed stats and fan out a 'status'
   * phase to the group room. The patch carries ONLY the recomputed
   * subTaskStats (and unchanged parent status) — admin step-20 will wholesale
   * replace `prev.subTaskStats` with `patch.subTaskStats`.
   *
   * Out of scope (per spec 2 step-19): do NOT mutate the parent's status here.
   * Running → Completed/PartialFailed/Failed transition stays in the existing
   * TranslationBatch / TranslationAll executor logic.
   */
  private async emitParentStatsRecompute(groupId: string): Promise<void> {
    const parentMeta = await this.getEmitMeta(groupId)
    if (!parentMeta) return
    const stats = await this.recomputeGroupStats(groupId)
    this.emitter.emitStatus(parentMeta, { subTaskStats: stats })
  }

  /**
   * Fetch the current totalCost in USD float, or undefined when the field is
   * absent (pre-spec-2 task hash) or zero. Used by emit paths so we never
   * surface noisy `totalCost: 0` patches for cache-hit / unbilled tasks.
   */
  private async readTotalCostUsd(taskId: string): Promise<number | undefined> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const raw = await this.redis.hget(taskKey, 'totalCost')
    if (raw === null || raw === '') return undefined
    const cents = Number(raw)
    if (!Number.isFinite(cents) || cents <= 0) return undefined
    return cents / 100
  }

  /**
   * Fetch the minimal task metadata needed for a TASK_UPDATE emit
   * (id / type / scope / groupId). Returns null when the task hash no longer
   * exists, so callers can skip the emit silently.
   */
  private async getEmitMeta(taskId: string): Promise<{
    id: string
    type: string
    scope: string
    groupId?: string
  } | null> {
    const taskKey = this.getKey(TASK_QUEUE_KEYS.task(taskId))
    const [type, scope, groupId] = await this.redis.hmget(
      taskKey,
      'type',
      'scope',
      'groupId',
    )
    if (!type) return null
    return {
      id: taskId,
      type,
      scope: scope || '',
      groupId: groupId || undefined,
    }
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `${timestamp}-${random}`
  }
}
