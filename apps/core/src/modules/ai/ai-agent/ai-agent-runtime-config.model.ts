import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { AI_AGENT_RUNTIME_CONFIG_COLLECTION_NAME } from '~/constants/db.constant'
import type { AIAgentRuntimeConfigValue } from './ai-agent.types'

@modelOptions({
  options: {
    customName: AI_AGENT_RUNTIME_CONFIG_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ key: 1 }, { unique: true })
export class AIAgentRuntimeConfigModel {
  @prop({ required: true, default: 'default' })
  key: string

  @prop({ type: () => [Object], default: [] })
  providers: AIAgentRuntimeConfigValue['providers']

  @prop({ type: () => Object })
  agentModel?: AIAgentRuntimeConfigValue['agentModel']

  @prop({ type: () => [String], default: [] })
  enabledTools: AIAgentRuntimeConfigValue['enabledTools']

  @prop({ type: Date, default: () => new Date() })
  updated?: Date
}
