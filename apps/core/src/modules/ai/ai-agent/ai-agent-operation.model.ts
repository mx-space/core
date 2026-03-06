import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'

import { AI_AGENT_OPERATION_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

import { AIAgentOperationMode, AIAgentOperationStatus } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_OPERATION_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ sessionId: 1, created: -1 })
@index({ sessionId: 1, status: 1, created: -1 })
export class AIAgentOperationModel extends BaseModel {
  @prop({ required: true })
  sessionId: string

  @prop({ required: true, enum: AIAgentOperationMode, type: String })
  mode: AIAgentOperationMode

  @prop({
    required: true,
    enum: AIAgentOperationStatus,
    type: String,
    default: AIAgentOperationStatus.Queued,
  })
  status: AIAgentOperationStatus

  @prop({ type: String })
  prompt?: string

  @prop({ type: Number, default: 0 })
  stepCount: number

  @prop({ type: Number, default: 0 })
  costTotal: number

  @prop({ type: Date })
  startedAt?: Date

  @prop({ type: Date })
  endedAt?: Date

  @prop({ type: String })
  error?: string

  @prop({ type: String })
  triggerActionId?: string
}
