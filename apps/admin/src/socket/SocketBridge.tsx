import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { NavigateFunction } from 'react-router'
import { useNavigate } from 'react-router'
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

import type { AITask } from '~/api/ai'
import {
  applyTaskPatch,
  prependTaskToList,
  removeTaskFromList,
  upsertTaskInList,
} from '~/features/ai/utils/ai'

import { GATEWAY_URL } from '../constants/env'
import { translate } from '../i18n/translate'
import { adminQueryKeys } from '../query/keys'
import type {
  AiTaskUpdatePayload,
  AiTaskUpdateStreamFrame,
  NotificationTypes,
} from './types'
import { EventTypes } from './types'

interface GatewayMessage {
  code?: number
  data?: unknown
  type: EventTypes
}

// Module-level singleton for hooks (step-22) — allows
// useAiTaskSubscription to emit ai-task:subscribe/unsubscribe without
// passing the socket through React context. Set by SocketBridge on mount
// and cleared on unmount.
let currentAdminSocket: Socket | null = null
const socketChangeListeners = new Set<(socket: Socket | null) => void>()

export function getAdminSocket(): Socket | null {
  return currentAdminSocket
}

/**
 * Subscribe to changes in the underlying socket instance (created /
 * destroyed when SocketBridge mounts / unmounts). Callback fires once
 * synchronously with the current value, then on every change. Returns
 * an unsubscribe function.
 */
export function subscribeAdminSocket(
  listener: (socket: Socket | null) => void,
): () => void {
  socketChangeListeners.add(listener)
  listener(currentAdminSocket)
  return () => {
    socketChangeListeners.delete(listener)
  }
}

function setAdminSocket(socket: Socket | null) {
  currentAdminSocket = socket
  for (const listener of socketChangeListeners) listener(socket)
}

export function SocketBridge() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!GATEWAY_URL) return

    let disposed = false
    let reconnectTimer: null | number = null
    const socket = io(`${GATEWAY_URL}/admin`, {
      forceNew: true,
      timeout: 10000,
      transports: ['websocket'],
      withCredentials: true,
    })
    setAdminSocket(socket)

    const handleEvent = (type: EventTypes, payload: unknown, code?: number) => {
      window.dispatchEvent(
        new CustomEvent('mx-admin:socket-event', {
          detail: { code, payload, type },
        }),
      )

      switch (type) {
        case EventTypes.AUTH_FAILED: {
          socket.close()
          break
        }
        case EventTypes.GATEWAY_DISCONNECT: {
          toast.warning(
            readPayloadMessage(payload, translate('socket.gatewayDisconnect')),
          )
          break
        }
        case EventTypes.COMMENT_CREATE: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.comments.root,
          })
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.aggregate.root,
          })
          notifyNewComment(payload, navigate)
          break
        }
        case EventTypes.LINK_APPLY: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.links.root,
          })
          notifyLinkApply(payload, navigate)
          break
        }
        case EventTypes.ADMIN_NOTIFICATION: {
          notifyAdmin(payload)
          break
        }
        case EventTypes.CONTENT_REFRESH: {
          toast.warning(translate('socket.contentRefresh'))
          window.setTimeout(() => {
            window.location.reload()
          }, 1000)
          break
        }
        case EventTypes.POST_CREATE:
        case EventTypes.POST_UPDATE:
        case EventTypes.POST_DELETE: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.posts.root,
          })
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.aggregate.root,
          })
          break
        }
        case EventTypes.NOTE_CREATE:
        case EventTypes.NOTE_UPDATE:
        case EventTypes.NOTE_DELETE: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.notes.root,
          })
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.aggregate.root,
          })
          break
        }
        case EventTypes.PAGE_UPDATED: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.pages.root,
          })
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.aggregate.root,
          })
          break
        }
        case EventTypes.SAY_CREATE:
        case EventTypes.SAY_UPDATE:
        case EventTypes.SAY_DELETE: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.says.root,
          })
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.aggregate.root,
          })
          break
        }
        case EventTypes.IMAGE_FETCH:
        case EventTypes.IMAGE_REFRESH: {
          void queryClient.invalidateQueries({
            queryKey: adminQueryKeys.files.root,
          })
          break
        }
        case EventTypes.AI_TASK_UPDATE: {
          handleAiTaskUpdate(queryClient, payload)
          break
        }
        default: {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console -- dev-only fallthrough trace
            console.debug('[socket]', type, payload, code)
          }
        }
      }
    }

    socket.on('message', (message: string | GatewayMessage) => {
      const parsed = parseGatewayMessage(message)
      if (!parsed) return

      handleEvent(parsed.type, parsed.data, parsed.code)
    })

    socket.on('connect_error', () => {
      if (import.meta.env.DEV) toast.error(translate('socket.connectionError'))
    })
    socket.io.on('error', () => {
      if (import.meta.env.DEV) toast.error(translate('socket.connectionError'))
    })
    socket.io.on('reconnect', () => {
      if (import.meta.env.DEV) toast.info(translate('socket.reconnectSuccess'))
    })
    socket.io.on('reconnect_attempt', () => {
      if (import.meta.env.DEV) toast.info(translate('socket.reconnecting'))
    })
    socket.io.on('reconnect_failed', () => {
      if (import.meta.env.DEV) toast.info(translate('socket.reconnectFailed'))
    })
    socket.on('disconnect', () => {
      if (disposed || reconnectTimer) return
      reconnectTimer = reconnectUntilConnected(socket, () => disposed)
    })

    return () => {
      disposed = true
      if (reconnectTimer) window.clearInterval(reconnectTimer)
      setAdminSocket(null)
      socket.disconnect()
      socket.off('message')
      socket.offAny()
    }
  }, [navigate, queryClient])

  return null
}

function parseGatewayMessage(message: string | GatewayMessage) {
  if (typeof message !== 'string') return message

  try {
    return JSON.parse(message) as GatewayMessage
  } catch {
    return null
  }
}

function reconnectUntilConnected(socket: Socket, isDisposed: () => boolean) {
  const timer = window.setInterval(() => {
    if (isDisposed() || socket.connected) {
      window.clearInterval(timer)
      return
    }

    socket.io.connect()
  }, 2000)

  return timer
}

function notifyNewComment(payload: unknown, navigate: NavigateFunction) {
  const comment = asRecord(payload)
  const author = readString(comment.author) || translate('socket.anonymous')
  const text = readString(comment.text)
  const body = text ? `${author}: ${text}` : author
  const toastId = toast.success(translate('socket.newComment'), {
    action: {
      label: translate('common.view'),
      onClick: () => {
        navigate('/comments?state=0')
        toast.dismiss(toastId)
      },
    },
    description: body,
    duration: 10000,
  })

  void showBrowserNotification(
    translate('socket.notificationCommentTitle'),
    body,
    () => {
      if (document.hasFocus()) {
        navigate('/comments?state=0')
      } else {
        window.open(
          `${window.location.origin}${window.location.pathname}#/comments?state=0`,
        )
      }
    },
  )
}

function notifyLinkApply(payload: unknown, navigate: NavigateFunction) {
  const sitename =
    readString(asRecord(payload).name) || translate('socket.newLinkApply')
  const toastId = toast.success(translate('socket.newLinkApply'), {
    action: {
      label: translate('common.view'),
      onClick: () => {
        navigate('/friends?state=1')
        toast.dismiss(toastId)
      },
    },
    description: sitename,
    duration: 10000,
  })

  void showBrowserNotification(
    translate('socket.notificationLinkApplyTitle'),
    sitename,
    () => {
      if (document.hasFocus()) {
        navigate('/friends?state=1')
      } else {
        window.open(
          `${window.location.origin}${window.location.pathname}#/friends?state=1`,
        )
      }
    },
  )
}

function notifyAdmin(payload: unknown) {
  const notification = asRecord(payload)
  const type = readString(notification.type) as NotificationTypes | ''
  const message = readString(notification.message)

  if (!message) return

  notifyByType(type, message)
}

function notifyByType(type: NotificationTypes | '', message: string) {
  switch (type) {
    case 'error': {
      toast.error(message)
      break
    }
    case 'success': {
      toast.success(message)
      break
    }
    case 'warn': {
      toast.warning(message)
      break
    }
    case 'info':
    default: {
      toast.info(message)
    }
  }
}

async function showBrowserNotification(
  title: string,
  body: string,
  onClick: () => void,
) {
  if (!('Notification' in window) || document.hasFocus()) return

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission

  if (permission !== 'granted') return

  const notification = new Notification(title, { body })
  notification.addEventListener('click', onClick)
}

function readPayloadMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/**
 * AI_TASK_UPDATE phase router. Per spec 2 plan step-20:
 *  - 'created'  : full Task snapshot — PREPEND to every list page-1 cache;
 *                 also setQueryData for taskDetail(id).
 *  - 'started' | 'status' | 'result' : upsert in list caches by id; patch
 *                 the detail cache via applyTaskPatch.
 *  - 'progress' | 'log' : detail cache only (list shows status, not progress
 *                 noise).
 *  - 'stream'   : dispatch a CustomEvent; NEVER touch TanStack cache.
 *  - 'deleted'  : remove the row from every list cache AND removeQueries
 *                 on the detail cache entry.
 *  - When groupId is present on any non-stream phase, ALSO wholesale-replace
 *    the parent group's subTaskStats on its detail cache (server guarantees
 *    a full SubTaskStats object per step-19).
 */
function handleAiTaskUpdate(queryClient: QueryClient, payload: unknown) {
  if (!isAiTaskUpdatePayload(payload)) return

  const { id, groupId, phase, patch, log, stream } = payload

  if (phase === 'stream') {
    window.dispatchEvent(
      new CustomEvent<{
        groupId?: string
        stream?: AiTaskUpdateStreamFrame
        taskId: string
      }>('mx-admin:ai-task-stream', {
        detail: { groupId, stream, taskId: id },
      }),
    )
    return
  }

  if (phase === 'deleted') {
    for (const [key, data] of queryClient.getQueriesData({
      queryKey: adminQueryKeys.ai.tasksRoot,
    })) {
      if (!data) continue
      const next = removeTaskFromList(data, id)
      if (next !== data) queryClient.setQueryData(key, next)
    }
    queryClient.removeQueries({ queryKey: adminQueryKeys.ai.taskDetail(id) })
    if (groupId) {
      queryClient.setQueryData<AITask[] | undefined>(
        adminQueryKeys.ai.tasksByGroup(groupId),
        (prev) => {
          if (!prev) return prev
          const next = prev.filter((t) => t.id !== id)
          return next.length === prev.length ? prev : next
        },
      )
    }
    return
  }

  if (phase === 'created') {
    const fullTask = patch as AITask
    queryClient.setQueryData(adminQueryKeys.ai.taskDetail(id), fullTask)
    for (const [key, data] of queryClient.getQueriesData({
      queryKey: adminQueryKeys.ai.tasksRoot,
    })) {
      if (!data) continue
      const next = prependTaskToList(data, fullTask)
      if (next !== data) queryClient.setQueryData(key, next)
    }
  } else {
    queryClient.setQueryData<AITask | undefined>(
      adminQueryKeys.ai.taskDetail(id),
      (prev) => (prev ? applyTaskPatch(prev, patch, log) : prev),
    )
    if (
      (phase === 'started' || phase === 'status' || phase === 'result') &&
      patch
    ) {
      for (const [key, data] of queryClient.getQueriesData({
        queryKey: adminQueryKeys.ai.tasksRoot,
      })) {
        if (!data) continue
        const next = upsertTaskInList(data, id, patch)
        if (next !== data) queryClient.setQueryData(key, next)
      }
    }
  }

  if (groupId && patch?.subTaskStats) {
    const { subTaskStats } = patch
    queryClient.setQueryData<AITask | undefined>(
      adminQueryKeys.ai.taskDetail(groupId),
      (prev) => (prev ? { ...prev, subTaskStats } : prev),
    )
  }

  // Per spec 2 step-25 — keep the parent's child-task list cache live so
  // SubTaskList rows update in real time. 'deleted' / 'stream' phases are
  // handled above; here we cover 'created' (append/replace full snapshot)
  // and every patch phase (status/progress/log/result/started).
  if (groupId) {
    queryClient.setQueryData<AITask[] | undefined>(
      adminQueryKeys.ai.tasksByGroup(groupId),
      (prev) => {
        if (!prev) return prev
        const idx = prev.findIndex((t) => t.id === id)
        if (phase === 'created') {
          const fullTask = patch as AITask
          if (idx < 0) return [...prev, fullTask]
          const next = prev.slice()
          next[idx] = fullTask
          return next
        }
        if (idx < 0) return prev
        const merged = applyTaskPatch(prev[idx], patch, log)
        if (merged === prev[idx]) return prev
        const next = prev.slice()
        next[idx] = merged
        return next
      },
    )
  }
}

function isAiTaskUpdatePayload(value: unknown): value is AiTaskUpdatePayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.phase === 'string'
}
