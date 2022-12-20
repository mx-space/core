import { BaseModel } from './base'

export interface UserModel extends BaseModel {
  introduce: string
  mail: string
  url: string
  name: string
  socialIds: Record<string, string>
  username: string
  modified: string
  v: number
  lastLoginTime: string
  lastLoginIp?: string
  avatar: string
  postID: string
}

export type TLogin = {
  token: string
  expiresIn: number
  // 登陆足迹
  lastLoginTime: null | string
  lastLoginIp?: null | string
} & Pick<
  UserModel,
  'name' | 'username' | 'created' | 'url' | 'mail' | 'avatar' | 'id'
>
