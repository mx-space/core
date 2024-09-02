export interface ActivityLikePayload {
  id: string
  ip: string
  type: ActivityLikeSupportType
}

export type ActivityLikeSupportType = 'post' | 'note'

export interface ActivityPresence {
  operationTime: number
  updatedAt: number
  connectedAt: number
  identity: string
  roomName: string
  position: number
  sid: string
  displayName?: string

  ip?: string
  readerId?: string
}
