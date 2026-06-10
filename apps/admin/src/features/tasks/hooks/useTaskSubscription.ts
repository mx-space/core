import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'

import { adminQueryKeys } from '~/query/keys'
import { subscribeAdminSocket } from '~/socket/SocketBridge'

type SubscribePayload = { all: true } | { groupId: string } | { taskId: string }

interface UseSubscriptionResult {
  socketConnected: boolean
}

function useTaskSubscription(
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

export function useTaskListSubscription(): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const onCatchUp = () => {
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.tasks.tasksRoot,
    })
  }
  return useTaskSubscription({ all: true }, onCatchUp)
}

export function useTaskDetailSubscription(
  taskId: null | string | undefined,
): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const payload = taskId ? { taskId } : null
  const onCatchUp = () => {
    if (!taskId) return
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.tasks.taskDetail(taskId),
    })
  }
  return useTaskSubscription(payload, onCatchUp)
}

export function useTaskGroupSubscription(
  groupId: null | string | undefined,
): UseSubscriptionResult {
  const queryClient = useQueryClient()
  const payload = groupId ? { groupId } : null
  const onCatchUp = () => {
    if (!groupId) return
    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.tasks.taskDetail(groupId),
    })
  }
  return useTaskSubscription(payload, onCatchUp)
}
