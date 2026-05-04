export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
  role?: 'owner' | 'reader'
  handle?: string | null
  username?: string | null
  displayUsername?: string | null
}

export interface AccountRow {
  id: string
  userId: string
  accountId: string | null
  providerId: string
  providerAccountId: string | null
  password: string | null
  type: string | null
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  idToken: string | null
  raw: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date | null
}

export interface SessionRow {
  id: string
  userId: string
  token: string
  expiresAt: Date | null
  ipAddress: string | null
  userAgent: string | null
  provider: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface ApiKeyRow {
  id: string
  userId: string | null
  referenceId: string | null
  configId: string | null
  name: string | null
  key: string
  start: string | null
  prefix: string | null
  enabled: boolean
  rateLimitEnabled: boolean
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: number
  remaining: number | null
  refillInterval: number | null
  refillAmount: number | null
  expiresAt: Date | null
  lastRefillAt: Date | null
  lastRequest: Date | null
  permissions: unknown
  metadata: unknown
  createdAt: Date
  updatedAt: Date | null
}

export interface VerificationRow {
  id: string
  identifier: string
  value: string
  expiresAt: Date
}

export interface PasskeyRow {
  id: string
  userId: string
  name: string | null
  credentialId: string
  publicKey: string
  counter: number
  deviceType: string | null
  backedUp: boolean
  transports: string[] | null
  aaguid: string | null
  createdAt: Date
  updatedAt: Date | null
}
