import type { BaseModel } from './base'

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
  Reject,
}

export interface LinkModel extends BaseModel {
  name: string
  url: string
  avatar: string
  description?: string
  type: LinkType
  state: LinkState
  hide: boolean
  email: string
}
