import { modelOptions, prop } from '@typegoose/typegoose'
import { AI_AGENT_SESSION_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { AIAgentSessionStatus } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_SESSION_COLLECTION_NAME,
  },
})
export class AIAgentSessionModel extends BaseModel {
  @prop({ required: true, trim: true, default: 'Agent Session' })
  title: string

  @prop({
    required: true,
    type: String,
    enum: AIAgentSessionStatus,
    default: AIAgentSessionStatus.Active,
  })
  status: AIAgentSessionStatus

  @prop({ type: Date, default: () => new Date() })
  updated?: Date
}
