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
