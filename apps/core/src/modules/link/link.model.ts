import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'

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

export const LinkStateMap = {
  [LinkState.Pass]: '已通过',
  [LinkState.Audit]: '审核中',
  [LinkState.Outdate]: '已过期',
  [LinkState.Banned]: '已屏蔽',
  [LinkState.Reject]: '已拒绝',
}

@modelOptions({ options: { customName: 'Link' } })
export class LinkModel extends BaseModel {
  @prop({ required: true, trim: true, unique: true })
  name: string

  @prop({ required: true, trim: true, unique: true })
  url: string

  @prop({ trim: true })
  avatar?: string

  @prop({ trim: true })
  description?: string

  @prop({ default: LinkType.Friend })
  type?: LinkType

  @prop({ default: LinkState.Pass })
  state: LinkState

  @prop()
  email?: string

  get hide() {
    return this.state === LinkState.Audit
  }
  set hide(value) {
    return
  }
}
