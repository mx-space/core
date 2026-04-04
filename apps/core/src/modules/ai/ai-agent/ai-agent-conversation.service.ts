import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { InjectModel } from '~/transformers/model.transformer'

import { AIAgentConversationModel } from './ai-agent-conversation.model'

@Injectable()
export class AiAgentConversationService {
  private readonly logger = new Logger(AiAgentConversationService.name)

  constructor(
    @InjectModel(AIAgentConversationModel)
    private readonly conversationModel: MongooseModel<AIAgentConversationModel>,
  ) {}

  async create(data: {
    refId: string
    refType: string
    title?: string
    messages: Record<string, unknown>[]
    model: string
    providerId: string
  }) {
    return this.conversationModel.create(data)
  }

  async listByRef(refId: string, refType: string) {
    return this.conversationModel
      .find({ refId, refType }, { messages: 0 }) // exclude messages body for list
      .sort({ updated: -1 })
      .lean()
  }

  async getById(id: string) {
    const doc = await this.conversationModel.findById(id).lean()
    if (!doc) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFoundCantProcess,
        'Conversation not found',
      )
    }
    return doc
  }

  async appendMessages(id: string, messages: Record<string, unknown>[]) {
    const result = await this.conversationModel.findByIdAndUpdate(
      id,
      {
        $push: { messages: { $each: messages } },
        $set: { updated: new Date() },
      },
      { new: true, projection: { messages: 0 }, lean: true },
    )
    if (!result) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFoundCantProcess,
        'Conversation not found',
      )
    }
    return result
  }

  async deleteById(id: string) {
    await this.conversationModel.deleteOne({ _id: id })
  }
}
