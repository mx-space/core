import type { CollectionRefTypes } from '@core/constants/db.constant'
import type { CategoryModel } from './category'

export interface ActivityPresence {
  operationTime: number
  identity: string
  roomName: string
  position: number
  joinedAt: number
  connectedAt: number
  updatedAt: number
  readerId?: string

  displayName?: string
}

export interface RoomOmittedNote {
  title: string
  nid: number
  id: string
  created: string
}

export interface RoomOmittedPage {
  title: string
  slug: string
  id: string
  created: string
}

export interface RoomOmittedPost {
  slug: string
  title: string
  categoryId: string
  category: CategoryModel
  id: string
  created: string
}
export interface RoomsData {
  rooms: string[]
  roomCount: {
    [key: string]: number
  }
  objects: {
    posts: RoomOmittedPost[]
    notes: RoomOmittedNote[]
    pages: RoomOmittedPage[]
  }
}

export interface RecentActivities {
  like: RecentLike[]
  comment: RecentComment[]
  recent: RecentRecent[]
  post: RecentPost[]
  note: RecentNote[]
}

export interface RecentComment {
  created: string
  author: string
  text: string
  id: string
  title: string
  slug?: string
  type: string
  avatar: string
  nid?: string
}

export interface RecentLike {
  created: string
  id: string
  type: CollectionRefTypes.Post | CollectionRefTypes.Note
  nid?: number
  slug?: string
  title: string
}

export interface RecentNote {
  id: string
  created: string
  title: string
  modified: string
  nid: number
}

export interface RecentPost {
  id: string
  created: string
  title: string
  modified: string
  slug: string
}

export interface RecentRecent {
  id: string

  content: string
  up: number
  down: number
  created: string
}

export interface LastYearPublication {
  posts: PostsItem[]
  notes: NotesItem[]
}

interface PostsItem {
  id: string
  created: string
  title: string
  slug: string
  categoryId: string
  category: Category
}
interface Category {
  id: string
  type: number
  name: string
  slug: string
  created: string
}
interface NotesItem {
  id: string
  created: string
  title: string
  mood: string
  weather: string
  nid: number
  bookmark: boolean
}
