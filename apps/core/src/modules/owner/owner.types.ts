import { omit } from 'es-toolkit/compat'

export const securityKeys = [
  'lastLoginTime',
  'lastLoginIp',
  'password',
  'oauth2',
] as const

export interface OwnerModel {
  name: string
  username: string
  email?: string
  mail?: string
  password?: string
  [key: string]: any
}

export type OwnerDocument = OwnerModel
export type OwnerModelSecurityKeys = (typeof securityKeys)[number]

export interface OwnerProfileRow {
  id: string
  readerId: string
  mail: string | null
  url: string | null
  introduce: string | null
  lastLoginIp: string | null
  lastLoginTime: Date | null
  socialIds: Record<string, unknown> | null
  createdAt: Date
}

export const OwnerModel = {
  securityKeys,
  serialize(doc: OwnerModel) {
    return omit(doc, securityKeys)
  },
}
