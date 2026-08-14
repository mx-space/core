import type { WsClient, WsClientState } from '@mx-space/ws-client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { adminQueryKeys } from '~/query/keys'
import { subscribeAdminSocket } from '~/socket/SocketBridge'

type SubscribePayload = { all: true } | { groupId: string } | { taskId: string }

interface UseSubscriptionResult {
  socketConnected: boolean
}

// Room membership on the server is per-connection with no refcount — a
// second `ai_task.unsubscribe` for the same payload drops the room outright,
// even if another mount still wants it live. Multiple hook instances (two
// detail panels for the same task, a fast remount, React StrictMode's double
// invoke, or this effect simply re-running because `payload`/`onCatchUp` are
// fresh references every render of the caller) can all want the same
// payload at once, so "should the wire-level unsubscribe fire" has to be
// decided against how many current instances still want it, not just this
// one's own local state.
const wantSubscribedCounts = new Map<string, number>()

function payloadKey(payload: SubscribePayload): string {
  return JSON.stringify(payload)
}

function incrementWantCount(payload: SubscribePayload): void {
  const key = payloadKey(payload)
  wantSubscribedCounts.set(key, (wantSubscribedCounts.get(key) ?? 0) + 1)
}

function decrementWantCount(payload: SubscribePayload): void {
  const key = payloadKey(payload)
  const next = (wantSubscribedCounts.get(key) ?? 1) - 1
  if (next <= 0) wantSubscribedCounts.delete(key)
  else wantSubscribedCounts.set(key, next)
}

function hasWantCount(payload: SubscribePayload): boolean {
  return (wantSubscribedCounts.get(payloadKey(payload)) ?? 0) > 0
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
    // This instance's own current intent — separate from the shared
    // wantSubscribedCounts map, which aggregates intent across every mount
    // sharing this payload.
    let wantSubscribed = false
    const setWantSubscribed = (next: boolean) => {
      if (wantSubscribed === next) return
      wantSubscribed = next
      if (next) incrementWantCount(payload)
      else decrementWantCount(payload)
    }
    // A stale ack (this instance no longer wants the subscription by the
    // time it resolves) must only drop the room when nobody else sharing
    // this payload wants it either — otherwise it kills a sibling mount's
    // live subscription with no error or $state change to signal it.
    const maybeSendUnsubscribe = () => {
      if (hasWantCount(payload)) return
      void socket.request('ai_task.unsubscribe', payload).catch(() => {})
    }
    const subscribe = () => {
      setWantSubscribed(true)
      if (subscribed || pending) return
      pending = true
      socket
        .request('ai_task.subscribe', payload)
        .then(() => {
          pending = false
          if (wantSubscribed) {
            subscribed = true
          } else {
            maybeSendUnsubscribe()
          }
        })
        .catch(() => {
          pending = false
        })
    }
    const unsubscribe = () => {
      setWantSubscribed(false)
      pending = false
      if (!subscribed) return
      subscribed = false
      maybeSendUnsubscribe()
    }

    if (socket.state === 'open') subscribe()
    const offState = socket.on('$state', (state: WsClientState) => {
      if (state === 'open') {
        subscribe()
        onCatchUp()
      } else {
        setWantSubscribed(false)
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
