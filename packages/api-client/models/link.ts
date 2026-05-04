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

export interface LinkModel {
  id: string
  createdAt: string
  name: string
  url: string
  avatar: string | null
  description: string | null
  type: LinkType
  state: LinkState
  hide: boolean
  email: string | null
}
