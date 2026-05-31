import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import { createModelRuntime } from '../runtime'
import { AiAgentConversationRepository } from './ai-agent-conversation.repository'

@Injectable()
export class AiAgentConversationService {
  private readonly logger = new Logger(AiAgentConversationService.name)

  constructor(
    private readonly conversationRepository: AiAgentConversationRepository,
    private readonly configService: ConfigsService,
  ) {}

  async create(data: {
    sessionId: string
    messages?: Record<string, unknown>[]
    model?: string | null
    providerId?: string | null
  }) {
    return this.conversationRepository.create(data)
  }

  async listBySession(sessionId: string) {
    const rows = await this.conversationRepository.listBySession(sessionId)
    return rows.map(({ messages: _messages, ...row }) => row)
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
    const { messages: _messages, ...rest } = result
    return rest
  }

  async updateById(
    id: string,
    data: {
      sessionId?: string
      model?: string | null
      providerId?: string | null
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

  async generateAndPersistTitle(id: string) {
    const existing = await this.conversationRepository.findById(id)
    if (!existing) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }
    if (existing.title) {
      const { messages: _messages, ...rest } = existing
      return rest
    }
    if (!existing.model || !existing.providerId) {
      const { messages: _messages, ...rest } = existing
      return rest
    }

    const title = await this.generateTitle(
      existing.messages as Record<string, unknown>[],
      existing.model,
      existing.providerId,
    )
    if (!title) {
      const { messages: _messages, ...rest } = existing
      return rest
    }

    const updated = await this.conversationRepository.update(id, { title })
    if (!updated) {
      const { messages: _messages, ...rest } = existing
      return rest
    }
    const { messages: _messages, ...rest } = updated
    return rest
  }

  async generateTitle(
    allMessages: Record<string, unknown>[],
    model: string,
    providerId: string,
  ): Promise<string | null> {
    const firstUser = allMessages.find(
      (m) => m.role === 'user' || m.type === 'user',
    )
    const firstAssistant = allMessages.find(
      (m) => m.role === 'assistant' || m.type === 'assistant',
    )
    if (!firstUser || !firstAssistant) return null

    const aiConfig = await this.configService.get('ai')
    const provider = aiConfig.providers?.find(
      (p) => p.id === providerId && p.enabled,
    )
    if (!provider) {
      this.logger.warn(
        `generateTitle: provider "${providerId}" not found or disabled`,
      )
      return null
    }

    const runtime = createModelRuntime(provider, model)

    try {
      const result = await runtime.generateText({
        messages: [
          {
            role: 'system',
            content:
              'Summarize the topic of this conversation in 10 words or fewer. Reply with the title text only.',
          },
          {
            role: 'user',
            content: String(firstUser.content ?? '').slice(0, 500),
          },
          {
            role: 'assistant',
            content: String(firstAssistant.content ?? '').slice(0, 500),
          },
          {
            role: 'user',
            content:
              'Please summarize the topic of the conversation above in 10 words or fewer.',
          },
        ],
        maxRetries: 1,
      })
      const text = result.text?.trim()
      if (!text) return null
      return text
        .replaceAll(/^["'「]|["'」]$/g, '')
        .trim()
        .slice(0, 30)
    } catch (err: any) {
      this.logger.warn(`Title generation failed: ${err.message}`)
      return null
    }
  }
}
