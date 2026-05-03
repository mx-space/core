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
  createdAt: string
}

export interface RoomOmittedPage {
  title: string
  slug: string
  id: string
  createdAt: string
}

export interface RoomOmittedPost {
  slug: string
  title: string
  categoryId: string
  category: CategoryModel
  id: string
  createdAt: string
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
  createdAt: string
  author: string
  text: string
  id: string
  title: string
  slug?: string
  type: string
  avatar: string
  nid?: string
  category?: { slug: string; name: string }
}

export interface RecentLike {
  createdAt: string
  id: string
  type: CollectionRefTypes.Post | CollectionRefTypes.Note
  nid?: number
  slug?: string
  title: string
}

export interface RecentNote {
  id: string
  createdAt: string
  title: string
  modifiedAt: string | null
  nid: number
}

export interface RecentPost {
  id: string
  createdAt: string
  title: string
  modifiedAt: string | null
  slug: string
  category?: { slug: string; name: string }
}

export interface RecentRecent {
  id: string

  content: string
  up: number
  down: number
  createdAt: string
}

export interface LastYearPublication {
  posts: PostsItem[]
  notes: NotesItem[]
}

interface PostsItem {
  id: string
  createdAt: string
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
  createdAt: string
}
interface NotesItem {
  id: string
  createdAt: string
  title: string
  mood: string
  weather: string
  nid: number
  bookmark: boolean
}
