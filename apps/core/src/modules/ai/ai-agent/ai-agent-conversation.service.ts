import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { InjectModel } from '~/transformers/model.transformer'

import { AiAgentChatService } from './ai-agent-chat.service'
import { AIAgentConversationModel } from './ai-agent-conversation.model'

@Injectable()
export class AiAgentConversationService {
  private readonly logger = new Logger(AiAgentConversationService.name)

  constructor(
    @InjectModel(AIAgentConversationModel)
    private readonly conversationModel: MongooseModel<AIAgentConversationModel>,
    private readonly chatService: AiAgentChatService,
  ) {}

  async create(data: {
    refId: string
    refType: string
    title?: string
    messages: Record<string, unknown>[]
    model: string
    providerId: string
  }) {
    return this.conversationModel.create({
      ...data,
      messageCount: data.messages.length,
    })
  }

  async listByRef(refId: string, refType: string) {
    return this.conversationModel
      .find({ refId, refType }, { messages: 0 })
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
        $inc: { messageCount: messages.length },
      },
      { returnDocument: 'after', lean: true },
    )
    if (!result) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFoundCantProcess,
        'Conversation not found',
      )
    }

    if (
      !result.title &&
      messages.some((m) => m.role === 'assistant' || m.type === 'assistant')
    ) {
      this.generateTitle(id, result.messages, result.model, result.providerId)
    }

    const { messages: _messages, ...rest } = result
    return rest
  }

  async replaceMessages(id: string, messages: Record<string, unknown>[]) {
    const result = await this.conversationModel.findByIdAndUpdate(
      id,
      {
        $set: {
          messages,
          messageCount: messages.length,
          updated: new Date(),
        },
      },
      { returnDocument: 'after', lean: true },
    )
    if (!result) {
      throw new BizException(
        ErrorCodeEnum.ContentNotFoundCantProcess,
        'Conversation not found',
      )
    }

    if (
      !result.title &&
      messages.some((m) => m.role === 'assistant' || m.type === 'assistant')
    ) {
      this.generateTitle(id, messages, result.model, result.providerId)
    }

    const { messages: _messages, ...rest } = result
    return rest
  }

  async updateById(
    id: string,
    data: {
      title?: string
      reviewState?: Record<string, unknown> | null
      diffState?: Record<string, unknown> | null
    },
  ) {
    const $set: Record<string, unknown> = { updated: new Date() }
    if (data.title !== undefined) $set.title = data.title
    if (data.reviewState !== undefined) $set.reviewState = data.reviewState
    if (data.diffState !== undefined) $set.diffState = data.diffState

    const result = await this.conversationModel.findByIdAndUpdate(
      id,
      { $set },
      { returnDocument: 'after', projection: { messages: 0 }, lean: true },
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

  private generateTitle(
    conversationId: string,
    allMessages: Record<string, unknown>[],
    model: string,
    providerId: string,
  ) {
    const firstUser = allMessages.find(
      (m) => m.role === 'user' || m.type === 'user',
    )
    const firstAssistant = allMessages.find(
      (m) => m.role === 'assistant' || m.type === 'assistant',
    )
    if (!firstUser || !firstAssistant) return

    const titleMessages: Record<string, unknown>[] = [
      {
        role: 'system',
        content: '用 10 字以内概括这段对话的主题，只返回标题文字',
      },
      { role: 'user', content: String(firstUser.content ?? '').slice(0, 500) },
      {
        role: 'assistant',
        content: String(firstAssistant.content ?? '').slice(0, 500),
      },
      { role: 'user', content: '请用 10 字以内概括以上对话主题' },
    ]

    this.chatService
      .resolveProvider(providerId)
      .then((provider) => {
        const { url, headers, body } = this.chatService.buildRequestBody(
          provider,
          model,
          titleMessages,
        )

        const bodyObj = JSON.parse(body)
        bodyObj.stream = false
        delete bodyObj.thinking
        delete bodyObj.tools

        return fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyObj),
        })
      })
      .then((res) => {
        if (!res.ok) throw new Error(`Title gen failed: ${res.status}`)
        return res.json()
      })
      .then((json: any) => {
        let title: string | undefined
        if (json.content?.[0]?.text) {
          title = json.content[0].text
        } else if (json.choices?.[0]?.message?.content) {
          title = json.choices[0].message.content
        }
        if (title) {
          title = title
            .replaceAll(/^["'「]|["'」]$/g, '')
            .trim()
            .slice(0, 30)
          return this.conversationModel.updateOne(
            { _id: conversationId },
            { $set: { title } },
          )
        }
      })
      .catch((err) => {
        this.logger.warn(
          `Title generation failed for ${conversationId}: ${err.message}`,
        )
      })
  }
}
