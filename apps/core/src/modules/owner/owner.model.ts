import { omit } from 'es-toolkit/compat'

const securityKeys = [
  'lastLoginTime',
  'lastLoginIp',
  'password',
  'oauth2',
] as const

export class OwnerModel {
  id: string
  _id?: unknown

  username!: string
  name!: string
  introduce?: string
  avatar?: string
  password?: string
  mail?: string
  url?: string
  lastLoginTime?: Date
  lastLoginIp?: string
  socialIds?: Record<string, any>

  role?: 'reader' | 'owner'
  email?: string | null
  image?: string | null
  handle?: string
  displayUsername?: string
  created?: Date

  static securityKeys = securityKeys

  static serialize(doc: OwnerModel) {
    return omit(doc, this.securityKeys)
  }
}

export type OwnerDocument = OwnerModel

type ReadonlyArrayToUnion<T extends readonly any[]> = T[number]
export type OwnerModelSecurityKeys = ReadonlyArrayToUnion<typeof securityKeys>
