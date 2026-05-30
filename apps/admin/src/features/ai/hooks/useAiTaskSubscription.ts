import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'

import { adminQueryKeys } from '~/query/keys'
import { subscribeAdminSocket } from '~/socket/SocketBridge'

/**
 * Hooks for the per-room ai-task subscription protocol (spec 2 step-22).
 *
 * Each hook:
 *  - Emits `ai-task:subscribe` with its payload on mount and reciprocal
 *    `ai-task:unsubscribe` on unmount.
 *  - Re-subscribes on visibilitychange→visible and invalidates the
 *    relevant TanStack cache to catch up on any missed emits.
 *  - Re-subscribes after a socket reconnect, again invalidating to
 *    catch up.
 *
 * Each hook returns `{ socketConnected }` so callers can drive a
 * faster polling fallback while the gateway link is down.
 *
 * Subscribe payloads mirror the server contract in
 * apps/core/src/processors/gateway/admin/events.gateway.ts:
 *   - { taskId } → `ai-task:detail:${taskId}`
 *   - { groupId } → `ai-task:group:${groupId}`
 *   - { all: true } → `ai-task:list`
 */

type SubscribePayload = { all: true } | { groupId: string } | { taskId: string }

interface UseSubscriptionResult {
  socketConnected: boolean
}

function useAiTaskSubscription(
  payload: SubscribePayload | null,
  onCatchUp: () => void,
): UseSubscriptionResult {
  const [socket, setSocket] = useState<null | Socket>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    return subscribeAdminSocket((next) => {
      setSocket(next)
      setSocketConnected(Boolean(next?.connected))
    })
  }, [])

  useEffect(() => {
    if (!socket) return
    const handleConnect = () => setSocketConnected(true)
    const handleDisconnect = () => setSocketConnected(false)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket])

  useEffect(() => {
    if (!socket || !payload) return

    let subscribed = false
    const subscribe = () => {
      if (subscribed) return
      socket.emit('ai-task:subscribe', payload)
      subscribed = true
    }
    const unsubscribe = () => {
      if (!subscribed) return
      socket.emit('ai-task:unsubscribe', payload)
      subscribed = false
    }

    if (socket.connected) subscribe()
    const handleConnect = () => {
      subscribe()
      onCatchUp()
    }
    const handleDisconnect = () => {
      subscribed = false
    }
    const handleVisibility = () => {
      if (document.hidden) {
        unsubscribe()
      } else {
        if (socket.connected) subscribe()
        onCatchUp()
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubscribe()
    }
  }, [socket, payload, onCatchUp])

  return { socketConnected }
}

export function useAiTaskListSubscription(): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const onCatchUp = () => {
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.ai.tasksRoot,
    })
  }
  return useAiTaskSubscription({ all: true }, onCatchUp)
}

export function useAiTaskDetailSubscription(
  taskId: null | string | undefined,
): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const payload = taskId ? { taskId } : null
  const onCatchUp = () => {
    if (!taskId) return
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.ai.taskDetail(taskId),
    })
  }
  return useAiTaskSubscription(payload, onCatchUp)
}

export function useAiTaskGroupSubscription(
  groupId: null | string | undefined,
): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const payload = groupId ? { groupId } : null
  const onCatchUp = () => {
    if (!groupId) return
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.ai.taskDetail(groupId),
    })
  }
  return useAiTaskSubscription(payload, onCatchUp)
}
