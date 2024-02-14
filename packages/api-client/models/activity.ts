import type { CategoryModel } from './category'

export interface ActivityPresence {
  operationTime: number
  updatedAt: number
  connectedAt: number
  identity: string
  roomName: string
  position: number

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
