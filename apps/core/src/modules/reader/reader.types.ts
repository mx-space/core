import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface ReaderModel extends BaseModel {
  email?: string | null
  emailVerified?: boolean
  name?: string | null
  handle?: string | null
  username?: string | null
  displayUsername?: string | null
  image?: string | null
  role?: string
}

export interface ReaderRow {
  id: string
  email: string | null
  emailVerified: boolean
  name: string | null
  handle: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  role: string
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
  updatedAt: Date | null
  lastLoginAt?: Date | null
}
