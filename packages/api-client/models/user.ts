export interface UserModel {
  id: string
  createdAt: string
  username: string
  name: string
  avatar: string
  mail: string
  introduce?: string
  url?: string
  socialIds?: Record<string, string>
  lastLoginTime?: string
  lastLoginIp?: string | null
  role?: 'owner' | 'reader'
  email?: string
  image?: string
  handle?: string
  displayUsername?: string
}

export type TLogin = {
  token: string
  expiresIn: number
  // 登陆足迹
  lastLoginTime: null | string
  lastLoginIp?: null | string
} & Pick<
  UserModel,
  'name' | 'username' | 'createdAt' | 'url' | 'mail' | 'avatar' | 'id'
>

export type BetterAuthUserRole = 'owner' | 'reader'

export interface BetterAuthUser {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
  role?: BetterAuthUserRole
  handle?: string | null
  username?: string | null
  displayUsername?: string | null
  [key: string]: unknown
}

export interface BetterAuthSession {
  id?: string
  token: string
  userId: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  ipAddress?: string | null
  userAgent?: string | null
  provider?: string | null
  [key: string]: unknown
}

export interface BetterAuthSignInResult {
  token: string
  user: BetterAuthUser
}

export interface BetterAuthSessionResult {
  session: BetterAuthSession
  user: BetterAuthUser
}

export interface OwnerSessionResult extends BetterAuthUser {
  provider?: string
  providerAccountId?: string
  session?: BetterAuthSession
}

export type CheckLoggedResult = {
  ok: number
  isGuest: boolean
}

export type OwnerAllowLoginResult = {
  password: boolean
  passkey: boolean
} & Record<string, boolean>
