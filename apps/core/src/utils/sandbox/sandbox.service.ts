import { Worker } from 'node:worker_threads'

import type {
  BridgeCallPayload,
  ExecutePayload,
  SandboxContext,
  SandboxResult,
  WorkerMessage,
} from './sandbox.types'
import { WorkerMessageType } from './sandbox.types'
import sandboxWorkerCode from './sandbox-worker.runtime.js?raw'

interface BridgeHandlers {
  'storage.cache.get': (key: string) => Promise<unknown>
  'storage.cache.set': (
    key: string,
    value: unknown,
    ttl?: number,
  ) => Promise<void>
  'storage.cache.del': (key: string) => Promise<void>
  'storage.db.get': (namespace: string, key: string) => Promise<unknown>
  'storage.db.find': (namespace: string, condition: unknown) => Promise<unknown>
  'storage.db.set': (
    namespace: string,
    key: string,
    value: unknown,
  ) => Promise<unknown>
  'storage.db.insert': (
    namespace: string,
    key: string,
    value: unknown,
  ) => Promise<unknown>
  'storage.db.update': (
    namespace: string,
    key: string,
    value: unknown,
  ) => Promise<unknown>
  'storage.db.del': (namespace: string, key: string) => Promise<unknown>
  getOwner: () => Promise<unknown>
  'config.get': (key: string) => Promise<unknown>
  broadcast: (type: string, data: unknown) => void
  writeAsset: (path: string, data: unknown, options?: unknown) => Promise<void>
  readAsset: (path: string, options?: unknown) => Promise<unknown>
}

export interface SandboxServiceOptions {
  maxWorkers?: number
  minWorkers?: number
  defaultTimeout?: number
  requireBasePath?: string
  bridgeHandlers: Partial<BridgeHandlers>
  /** Idle duration (ms) before a Worker is reclaimed. Default: 60000 (1 minute) */
  idleTimeout?: number
}

interface PooledWorker {
  worker: Worker
  busy: boolean
  lastUsed: number
  terminating: boolean
}

interface PendingExecution {
  resolve: (result: SandboxResult) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export class SandboxService {
  private workers: PooledWorker[] = []
  private pendingExecutions = new Map<string, PendingExecution>()
  private options: Required<SandboxServiceOptions>
  private workerCode = sandboxWorkerCode
  private initialized = false
  private idleCleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: SandboxServiceOptions) {
    this.options = {
      maxWorkers: options.maxWorkers ?? 4,
      minWorkers: options.minWorkers ?? 1,
      defaultTimeout: options.defaultTimeout ?? 30000,
      requireBasePath: options.requireBasePath ?? process.cwd(),
      bridgeHandlers: options.bridgeHandlers,
      idleTimeout: options.idleTimeout ?? 60000, // Default 1 minute
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Create the minimum number of Workers
    const initPromises: Promise<void>[] = []
    for (let i = 0; i < this.options.minWorkers; i++) {
      initPromises.push(
        this.createWorker().then((w) => {
          this.workers.push(w)
        }),
      )
    }
    await Promise.all(initPromises)

    // Start the idle cleanup timer
    this.startIdleCleanup()
    this.initialized = true
  }

  private startIdleCleanup(): void {
    // Check for idle Workers every 30 seconds
    this.idleCleanupInterval = setInterval(() => {
      this.cleanupIdleWorkers()
    }, 30000)
  }

  private cleanupIdleWorkers(): void {
    const now = Date.now()
    const idleTimeout = this.options.idleTimeout

    // Find Workers that have been idle past the timeout (keeping the minimum count)
    const idleWorkers = this.workers.filter(
      (w) => !w.busy && now - w.lastUsed > idleTimeout,
    )

    // Ensure at least minWorkers remain alive
    const toRemove = Math.min(
      idleWorkers.length,
      this.workers.length - this.options.minWorkers,
    )

    for (let i = 0; i < toRemove; i++) {
      const worker = idleWorkers[i]
      this.terminateWorker(worker)
    }
  }

  private terminateWorker(pooledWorker: PooledWorker): void {
    pooledWorker.terminating = true
    pooledWorker.worker.postMessage({
      id: generateId(),
      type: WorkerMessageType.Terminate,
      payload: null,
    })
    pooledWorker.worker.terminate()
    this.removeWorker(pooledWorker)
  }

  private async createWorker(): Promise<PooledWorker> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.workerCode, {
        eval: true,
        workerData: {
          requireBasePath: this.options.requireBasePath,
        },
        // Cap each Worker's resource usage so it does not impact the main process
        resourceLimits: {
          maxOldGenerationSizeMb: 128, // V8 old-generation memory limit
          maxYoungGenerationSizeMb: 32, // V8 young-generation memory limit
          codeRangeSizeMb: 32, // Code segment memory limit
          stackSizeMb: 4, // Stack size limit
        },
      })

      const pooledWorker: PooledWorker = {
        worker,
        busy: false,
        lastUsed: Date.now(),
        terminating: false,
      }

      const onReady = (message: WorkerMessage) => {
        if (
          message.type === WorkerMessageType.Result &&
          (message.payload as { ready?: boolean }).ready
        ) {
          worker.off('message', onReady)
          this.setupWorkerHandlers(pooledWorker)
          resolve(pooledWorker)
        }
      }

      worker.on('message', onReady)
      worker.on('error', reject)

      setTimeout(() => {
        worker.off('message', onReady)
        reject(new Error('Worker initialization timeout'))
      }, 10000)
    })
  }

  private setupWorkerHandlers(pooledWorker: PooledWorker): void {
    const { worker } = pooledWorker

    worker.on('message', async (message: WorkerMessage) => {
      const { id, type, payload } = message

      switch (type) {
        case WorkerMessageType.Result: {
          const pending = this.pendingExecutions.get(id)
          if (pending) {
            clearTimeout(pending.timeoutId)
            this.pendingExecutions.delete(id)
            pooledWorker.busy = false
            pooledWorker.lastUsed = Date.now()
            pending.resolve(payload as SandboxResult)
          }
          break
        }

        case WorkerMessageType.BridgeCall: {
          const { method, args } = payload as BridgeCallPayload
          try {
            const handler = this.options.bridgeHandlers[
              method as keyof BridgeHandlers
            ] as ((...args: unknown[]) => unknown) | undefined

            if (!handler) {
              worker.postMessage({
                id,
                type: WorkerMessageType.BridgeResponse,
                payload: {
                  success: false,
                  error: `Bridge method "${method}" not implemented`,
                },
              })
              return
            }

            const result = await handler(...(args as unknown[]))
            worker.postMessage({
              id,
              type: WorkerMessageType.BridgeResponse,
              payload: { success: true, data: result },
            })
          } catch (error) {
            worker.postMessage({
              id,
              type: WorkerMessageType.BridgeResponse,
              payload: {
                success: false,
                error: (error as Error).message || 'Bridge call failed',
              },
            })
          }
          break
        }

        case WorkerMessageType.Error: {
          const pending = this.pendingExecutions.get(id)
          if (pending) {
            clearTimeout(pending.timeoutId)
            this.pendingExecutions.delete(id)
            pooledWorker.busy = false
            pending.reject(new Error((payload as { message: string }).message))
          }
          break
        }
      }
    })

    worker.on('error', (error) => {
      console.error('[SandboxService] Worker error:', error)
      this.removeWorker(pooledWorker)
    })

    worker.on('exit', (code) => {
      if (code !== 0 && !pooledWorker.terminating) {
        console.error(`[SandboxService] Worker exited with code ${code}`)
      }
      this.removeWorker(pooledWorker)
    })
  }

  private removeWorker(pooledWorker: PooledWorker): void {
    const index = this.workers.indexOf(pooledWorker)
    if (index !== -1) {
      this.workers.splice(index, 1)
    }
  }

  private async getAvailableWorker(): Promise<PooledWorker> {
    let worker = this.workers.find((w) => !w.busy)

    if (!worker && this.workers.length < this.options.maxWorkers) {
      worker = await this.createWorker()
      this.workers.push(worker)
    }

    if (!worker) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const available = this.workers.find((w) => !w.busy)
          if (available) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
      })
      worker = this.workers.find((w) => !w.busy)!
    }

    return worker
  }

  async execute(
    code: string,
    context: SandboxContext,
    options?: {
      timeout?: number
      namespace?: string
    },
  ): Promise<SandboxResult> {
    if (!this.initialized) {
      await this.initialize()
    }

    const pooledWorker = await this.getAvailableWorker()
    pooledWorker.busy = true

    const id = generateId()
    const timeout = options?.timeout ?? this.options.defaultTimeout
    const namespace =
      options?.namespace ?? `${context.model.reference}/${context.model.name}`

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingExecutions.delete(id)
        pooledWorker.busy = false
        pooledWorker.terminating = true

        pooledWorker.worker.terminate().then(() => {
          this.removeWorker(pooledWorker)
        })

        reject(new Error(`Sandbox execution timeout after ${timeout}ms`))
      }, timeout + 1000)

      this.pendingExecutions.set(id, { resolve, reject, timeoutId })

      const payload: ExecutePayload = {
        code,
        context,
        timeout,
        namespace,
      }

      pooledWorker.worker.postMessage({
        id,
        type: WorkerMessageType.Execute,
        payload,
      })
    })
  }

  async shutdown(): Promise<void> {
    // Stop the idle cleanup timer
    if (this.idleCleanupInterval) {
      clearInterval(this.idleCleanupInterval)
      this.idleCleanupInterval = null
    }

    const terminatePromises = this.workers.map((pooledWorker) => {
      pooledWorker.terminating = true
      pooledWorker.worker.postMessage({
        id: generateId(),
        type: WorkerMessageType.Terminate,
        payload: null,
      })
      return pooledWorker.worker.terminate()
    })

    await Promise.all(terminatePromises)
    this.workers = []
    this.pendingExecutions.clear()
    this.initialized = false
  }

  getStats(): {
    totalWorkers: number
    busyWorkers: number
    pendingExecutions: number
  } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      pendingExecutions: this.pendingExecutions.size,
    }
  }
}
