import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { AI_AGENT_ACTION_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { AIAgentActionRiskLevel, AIAgentActionState } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_ACTION_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ sessionId: 1, state: 1, created: -1 })
export class AIAgentActionModel extends BaseModel {
  @prop({ required: true })
  sessionId: string

  @prop({ required: true })
  toolName: string

  @prop({ type: () => Object, required: true })
  arguments: Record<string, unknown>

  @prop({
    required: true,
    enum: AIAgentActionRiskLevel,
    default: AIAgentActionRiskLevel.Dangerous,
    type: String,
  })
  riskLevel: AIAgentActionRiskLevel

  @prop({
    required: true,
    enum: AIAgentActionState,
    default: AIAgentActionState.Pending,
    type: String,
  })
  state: AIAgentActionState

  @prop({ type: () => Object })
  dryRunPreview?: Record<string, unknown>

  @prop({ type: () => Object })
  result?: Record<string, unknown>

  @prop()
  error?: string

  @prop()
  confirmedBy?: string

  @prop({ type: Date, default: () => new Date() })
  updated?: Date
}
