export interface UserModel {
  ok?: number
  id: string
  introduce?: string
  mail?: string
  url?: string
  name: string
  socialIds?: Record<string, string | number>
  username: string
  role?: 'reader' | 'owner'
  email?: string
  image?: string
  handle?: string
  displayUsername?: string
  createdAt?: string | Date
  lastLoginTime?: string
  lastLoginIp?: string
  avatar?: string
  postID?: string
}
