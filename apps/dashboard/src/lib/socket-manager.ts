import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

import { getSocketAuth } from './auth'

type SocketStatus = 'connected' | 'disconnected' | 'reconnecting'

interface QueuedEmit {
  event: string
  payload: unknown
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

export class AdvancedSocketManager {
  private socket: Socket | null = null
  private status: SocketStatus = 'disconnected'
  private offlineQueue: QueuedEmit[] = []
  private readonly namespace: string

  constructor(namespace: string) {
    this.namespace = namespace
  }

  getSocket() {
    return this.socket
  }

  getStatus() {
    return this.status
  }

  async connect(): Promise<Socket> {
    if (this.socket && this.socket.connected) return this.socket

    const auth = getSocketAuth()
    const socket = io(this.namespace, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      auth,
    })

    this.socket = socket
    this.status = 'reconnecting'

    socket.on('connect', () => {
      this.status = 'connected'
      this.flushOfflineQueue()
    })

    socket.on('disconnect', () => {
      this.status = 'disconnected'
    })

    socket.io.on('reconnect_attempt', () => {
      this.status = 'reconnecting'
    })

    socket.on('connect_error', (err: unknown) => {
      // keep status as reconnecting; server will retry
      console.error('[socket] connect_error', err)
    })

    return new Promise<Socket>((resolve) => {
      if (socket.connected) return resolve(socket)
      socket.once('connect', () => resolve(socket))
    })
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
    this.status = 'disconnected'
  }

  safeEmit<T = unknown, R = unknown>(event: string, payload?: T) {
    return new Promise<R>((resolve, reject) => {
      const sock = this.socket
      if (sock && sock.connected) {
        // Prefer ack callback pattern
        try {
          sock
            .timeout(10_000)
            .emit(event, payload as any, (err: unknown, res: R) => {
              if (err) return reject(err)
              resolve(res)
            })
        } catch (e) {
          reject(e)
        }
      } else {
        this.offlineQueue.push({ event, payload, resolve, reject })
      }
    })
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.socket?.on(event, handler)
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.socket?.off(event, handler)
  }

  private flushOfflineQueue() {
    if (!this.socket || !this.socket.connected) return
    const queue = [...this.offlineQueue]
    this.offlineQueue.length = 0
    for (const item of queue) {
      try {
        this.socket
          .timeout(10_000)
          .emit(
            item.event,
            item.payload as any,
            (err: unknown, res: unknown) => {
              if (err) return item.reject(err)
              item.resolve(res)
            },
          )
      } catch (e) {
        item.reject(e)
      }
    }
  }
}

export const adminSocketManager = new AdvancedSocketManager('/admin')
