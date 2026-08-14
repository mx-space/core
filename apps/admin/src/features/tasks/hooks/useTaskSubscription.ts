import type { WsClient, WsClientState } from '@mx-space/ws-client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

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
  const [socket, setSocket] = useState<null | WsClient>(null)
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    return subscribeAdminSocket((next) => {
      setSocket(next)
      setSocketConnected(next?.state === 'open')
    })
  }, [])

  useEffect(() => {
    if (!socket) return
    return socket.on('$state', (state: WsClientState) => {
      setSocketConnected(state === 'open')
    })
  }, [socket])

  useEffect(() => {
    if (!socket || !payload) return

    let subscribed = false
    let pending = false
    // Tracks the caller's current intent, independent of `subscribed`/
    // `pending` — a subscribe() ack can resolve after the effect has already
    // decided (via unmount or a visibility-hide) that it no longer wants the
    // subscription. Checking this inside the ack callback, instead of only
    // gating on `subscribed`, is what lets a stale ack still fire the
    // unsubscribe it owes the server rather than leaking a phantom
    // subscription for the life of the socket.
    let wantSubscribed = false
    const subscribe = () => {
      wantSubscribed = true
      if (subscribed || pending) return
      pending = true
      socket
        .request('ai_task.subscribe', payload)
        .then(() => {
          pending = false
          if (wantSubscribed) {
            subscribed = true
          } else {
            void socket.request('ai_task.unsubscribe', payload).catch(() => {})
          }
        })
        .catch(() => {
          pending = false
        })
    }
    const unsubscribe = () => {
      wantSubscribed = false
      pending = false
      if (!subscribed) return
      subscribed = false
      void socket.request('ai_task.unsubscribe', payload).catch(() => {})
    }

    if (socket.state === 'open') subscribe()
    const offState = socket.on('$state', (state: WsClientState) => {
      if (state === 'open') {
        subscribe()
        onCatchUp()
      } else {
        wantSubscribed = false
        subscribed = false
        pending = false
      }
    })
    const handleVisibility = () => {
      if (document.hidden) {
        unsubscribe()
      } else {
        if (socket.state === 'open') subscribe()
        onCatchUp()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      offState()
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
