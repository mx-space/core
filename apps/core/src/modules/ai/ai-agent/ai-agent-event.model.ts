import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'

import { AI_AGENT_EVENT_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

import { AIAgentEventType } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_EVENT_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ operationId: 1, seq: 1 }, { unique: true })
@index({ sessionId: 1, created: -1 })
export class AIAgentEventModel extends BaseModel {
  @prop({ required: true })
  sessionId: string

  @prop({ required: true })
  operationId: string

  @prop({ required: true })
  seq: number

  @prop({ required: true, enum: AIAgentEventType, type: String })
  type: AIAgentEventType

  @prop({ type: () => Object, required: true })
  payload: Record<string, unknown>
}
