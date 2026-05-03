import type { BaseModel } from '~/shared/types/legacy-model.type'

import type { LinkState, LinkType } from './link.enum'

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
