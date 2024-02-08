export interface ActivityLikePayload {
  id: string
  ip: string
  type: 'Note' | 'Post'
}

export type ActivityLikeSupportType = 'Post' | 'Note'

export interface ActivityPresence {
  operationTime: number
  updatedAt: number
  connectedAt: number
  identity: string
  roomName: string
  position: number
}
