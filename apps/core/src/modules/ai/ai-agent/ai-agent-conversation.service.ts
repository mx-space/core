import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'

import { AiAgentChatService } from './ai-agent-chat.service'
import { AiAgentConversationRepository } from './ai-agent-conversation.repository'

@Injectable()
export class AiAgentConversationService {
  private readonly logger = new Logger(AiAgentConversationService.name)

  constructor(
    private readonly conversationRepository: AiAgentConversationRepository,
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
    return this.conversationRepository.create(data)
  }

  async listByRef(refId: string, refType: string) {
    return (
      await this.conversationRepository.list({ refId, refType, size: 100 })
    ).data.map(({ messages: _messages, ...row }) => row)
  }

  async getById(id: string) {
    const doc = await this.conversationRepository.findById(id)
    if (!doc) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }
    return doc
  }

  async appendMessages(id: string, messages: Record<string, unknown>[]) {
    const existing = await this.conversationRepository.findById(id)
    const result = existing
      ? await this.conversationRepository.update(id, {
          messages: [...existing.messages, ...messages],
        })
      : null
    if (!result) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }

    if (
      !result.title &&
      messages.some((m) => m.role === 'assistant' || m.type === 'assistant')
    ) {
      this.generateTitle(
        id,
        result.messages as unknown as Record<string, unknown>[],
        result.model,
        result.providerId,
      )
    }

    const { messages: _messages, ...rest } = result
    return rest
  }

  async replaceMessages(id: string, messages: Record<string, unknown>[]) {
    const result = await this.conversationRepository.update(id, { messages })
    if (!result) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
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
    const result = await this.conversationRepository.update(id, data)
    if (!result) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }
    return result
  }

  async deleteById(id: string) {
    await this.conversationRepository.deleteById(id)
  }

  async deleteForRef(refId: string) {
    return this.conversationRepository.deleteForRef(refId)
  }

  @OnEvent(BusinessEvents.POST_DELETE)
  @OnEvent(BusinessEvents.NOTE_DELETE)
  @OnEvent(BusinessEvents.PAGE_DELETE)
  async handleDeleteArticle(event: { id: string }) {
    if (!event?.id) return
    try {
      await this.deleteForRef(event.id)
    } catch (err) {
      this.logger.warn(
        `cascade delete ai_agent_conversations for ${event.id} failed: ${
          err instanceof Error ? err.message : err
        }`,
      )
    }
  }

  private async generateTitle(
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
        content:
          'Summarize the topic of this conversation in 10 words or fewer. Reply with the title text only.',
      },
      { role: 'user', content: String(firstUser.content ?? '').slice(0, 500) },
      {
        role: 'assistant',
        content: String(firstAssistant.content ?? '').slice(0, 500),
      },
      {
        role: 'user',
        content:
          'Please summarize the topic of the conversation above in 10 words or fewer.',
      },
    ]

    try {
      const provider = await this.chatService.resolveProvider(providerId)
      const { url, headers, body } = this.chatService.buildRequestBody(
        provider,
        model,
        titleMessages,
      )

      const bodyObj = JSON.parse(body)
      bodyObj.stream = false
      delete bodyObj.thinking
      delete bodyObj.tools

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj),
      })
      if (!res.ok) throw new Error(`Title gen failed: ${res.status}`)
      const json: any = await res.json()

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
        await this.conversationRepository.update(conversationId, { title })
      }
    } catch (err: any) {
      this.logger.warn(
        `Title generation failed for ${conversationId}: ${err.message}`,
      )
    }
  }
}
