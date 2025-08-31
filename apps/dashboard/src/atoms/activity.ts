import { atom } from 'jotai'

import type { ActivityItem } from '~/lib/activity-types'
import { createAtomHooks } from '~/lib/jotai'

export type SocketConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'

const _activityFeedAtom = atom<ActivityItem[]>([])
const _socketStatusAtom = atom<SocketConnectionStatus>('disconnected')
const _unreadCountAtom = atom<number>(0)

export const [
  activityFeedAtom,
  useActivityFeed,
  useActivityFeedValue,
  useSetActivityFeed,
] = createAtomHooks(_activityFeedAtom)

export const [
  socketStatusAtom,
  useSocketStatus,
  useSocketStatusValue,
  useSetSocketStatus,
] = createAtomHooks(_socketStatusAtom)

export const [
  unreadCountAtom,
  useUnreadCount,
  useUnreadCountValue,
  useSetUnreadCount,
] = createAtomHooks(_unreadCountAtom)
