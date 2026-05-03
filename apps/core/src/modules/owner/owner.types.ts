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

export const OwnerModel = {
  securityKeys,
  serialize(doc: OwnerModel) {
    return omit(doc, securityKeys)
  },
}
