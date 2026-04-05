import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import mongoose from 'mongoose'

import { AI_AGENT_CONVERSATION_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: AI_AGENT_CONVERSATION_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
@index({ refId: 1, refType: 1 })
@index({ updated: -1 })
export class AIAgentConversationModel extends BaseModel {
  @prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  refId: string

  @prop({ required: true })
  refType: string

  @prop()
  title?: string

  /**
   * Full conversation messages stored as JSON.
   * Uses rich-agent-core ChatMessage format verbatim.
   */
  @prop({ required: true, type: () => [mongoose.Schema.Types.Mixed] })
  messages: Record<string, unknown>[]

  @prop({ required: true })
  model: string

  @prop({ required: true })
  providerId: string

  @prop({ type: () => mongoose.Schema.Types.Mixed })
  reviewState?: Record<string, unknown>

  @prop({ type: () => mongoose.Schema.Types.Mixed })
  diffState?: Record<string, unknown>

  @prop({ default: 0 })
  messageCount: number

  updated?: Date
}
