import type { TranslationKey } from '~/i18n/types'
import type { PaginateResult } from './base'

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
  avatar: string
  description?: string
  type: LinkType
  state: LinkState
  hide: boolean
  email: string
}

export type LinkResponse = PaginateResult<LinkModel>

export type LinkStateCount = {
  audit: number
  collection: number
  friends: number
  outdate: number
  banned: number
  reject: number
}

export const LinkStateNameKeys: Record<keyof typeof LinkState, TranslationKey> =
  {
    Audit: 'friends.tab.audit',
    Pass: 'friends.row.pass',
    Outdate: 'friends.tab.outdate',
    Banned: 'friends.tab.banned',
    Reject: 'friends.tab.reject',
  }
