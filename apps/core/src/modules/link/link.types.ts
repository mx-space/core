import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { LinkState, LinkType } from './link.enum'

export { LinkState, LinkType } from './link.enum'

export interface LinkModel extends BaseModel {
  name: string
  url: string
  avatar?: string
  description?: string
  type?: LinkType
  state: LinkState
  email?: string
  hide?: boolean
}

export interface LinkRow {
  id: string
  name: string
  url: string
  avatar: string | null
  description: string | null
  type: LinkType
  state: LinkState
  email: string | null
  hide: boolean
  createdAt: Date
}

export interface LinkCreateInput {
  name: string
  url: string
  avatar?: string | null
  description?: string | null
  type?: LinkType
  state?: LinkState
  email?: string | null
}

export type LinkPatchInput = Partial<LinkCreateInput>
