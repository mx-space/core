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

export type ReaderMembershipStatusFilter =
  'active' | 'on_hold' | 'cancelled' | 'expired' | 'none'

export interface ReaderMembershipSummary {
  status: string
  plan: string
  provider: string
  currentPeriodEnd: Date
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
  membership?: ReaderMembershipSummary | null
}
