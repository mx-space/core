import { index, modelOptions, prop } from '@typegoose/typegoose'

import { POLL_VOTE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: { customName: POLL_VOTE_COLLECTION_NAME },
})
@index({ pollId: 1, voterFingerprint: 1 }, { unique: true })
@index({ pollId: 1 })
export class PollVoteModel extends BaseModel {
  @prop({ required: true })
  pollId: string

  @prop({ required: true })
  voterFingerprint: string

  @prop({ required: true, type: () => [String] })
  optionIds: string[]
}
