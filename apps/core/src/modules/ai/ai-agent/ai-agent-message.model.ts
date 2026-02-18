import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { AI_AGENT_MESSAGE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { AIAgentMessageKind } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_MESSAGE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ sessionId: 1, seq: 1 }, { unique: true })
@index({ sessionId: 1, created: -1 })
export class AIAgentMessageModel extends BaseModel {
  @prop({ required: true })
  sessionId: string

  @prop({ required: true })
  seq: number

  @prop({ required: true })
  role: 'user' | 'assistant' | 'toolResult' | 'system'

  @prop({
    required: true,
    enum: AIAgentMessageKind,
    type: String,
  })
  kind: AIAgentMessageKind

  @prop({ type: () => Object, required: true })
  content: Record<string, unknown>
}
