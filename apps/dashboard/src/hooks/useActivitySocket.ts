import { useEffect } from 'react'

import {
  useActivityFeed,
  useSetSocketStatus,
  useSetUnreadCount,
  useUnreadCountValue,
} from '~/atoms/activity'
import type { ActivityItem } from '~/lib/activity-types'
import { adminSocketManager } from '~/lib/socket-manager'

export function useActivitySocket() {
  const [activities, setActivities] = useActivityFeed()
  const setStatus = useSetSocketStatus()
  const setUnread = useSetUnreadCount()
  const unread = useUnreadCountValue()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await adminSocketManager.connect()
      if (!mounted) return
      setStatus('connected')

      const onNew = (payload: {
        activity: ActivityItem
        totalUnread?: number
      }) => {
        setActivities((prev) => [payload.activity, ...prev])
        if (typeof payload.totalUnread === 'number')
          setUnread(payload.totalUnread)
      }
      const onUpdated = (payload: {
        activityId: string
        updates: Partial<ActivityItem>
      }) => {
        setActivities((prev) =>
          prev.map((it) =>
            it.id === payload.activityId ? { ...it, ...payload.updates } : it,
          ),
        )
      }

      const onConnect = () => setStatus('connected')
      const onDisconnect = () => setStatus('disconnected')
      const onReconnecting = () => setStatus('reconnecting')

      const s = adminSocketManager.getSocket()!
      s.on('activity:new', onNew)
      s.on('activity:updated', onUpdated)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      s.io.on('reconnect_attempt', onReconnecting)

      // initial fetch
      adminSocketManager
        .safeEmit<
          { page: number; limit: number },
          { list: ActivityItem[]; totalUnread?: number }
        >('activity:get_feed', { page: 1, limit: 20 })
        .then((res) => {
          if (!res) return
          setActivities(res.list ?? [])
          if (typeof res.totalUnread === 'number') setUnread(res.totalUnread)
        })
        .catch(() => {})

      return () => {
        s.off('activity:new', onNew)
        s.off('activity:updated', onUpdated)
        s.off('connect', onConnect)
        s.off('disconnect', onDisconnect)
        s.io.off('reconnect_attempt', onReconnecting as any)
      }
    })()

    return () => {
      mounted = false
    }
  }, [setActivities, setStatus, setUnread])

  const loadMore = async () => {
    const page = Math.floor(activities.length / 20) + 1
    const res = await adminSocketManager.safeEmit<
      { page: number; limit: number },
      { list: ActivityItem[] }
    >('activity:get_feed', { page, limit: 20 })
    if (res?.list?.length) {
      setActivities((prev) => [...prev, ...res.list])
    }
  }

  return { activities, unread, loadMore }
}
