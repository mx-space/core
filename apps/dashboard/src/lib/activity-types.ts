export interface ActivityAction {
  id: string
  label: string
  icon?: string
  type?: 'primary' | 'secondary' | 'destructive'
  handler?: (item: ActivityItem) => Promise<void> | void
  shortcut?: string
}

export interface ActivityAuthor {
  id?: string
  name: string
  avatar?: string
}

export interface ActivityMetadata {
  postId?: string
  importance?: 'low' | 'medium' | 'high' | 'urgent'
}

export interface ActivityItem {
  id: string
  type: 'comment' | 'post' | 'page' | 'system' | 'ai' | 'analytics'
  timestamp: string | Date
  title: string
  description?: string
  author?: ActivityAuthor
  metadata?: ActivityMetadata
  actions?: ActivityAction[]
  isRead?: boolean
  isPending?: boolean
}
