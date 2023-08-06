export interface ActivityLikePayload {
  id: string
  ip: string
  type: 'Note' | 'Post'
}

export type ActivityLikeSupportType = 'Post' | 'Note'
