import type { Message as PiMessage } from '@earendil-works/pi-ai'
import { createModelRuntime } from '@mx-space/ai/runtime'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import { AiAgentConversationRepository } from './ai-agent-conversation.repository'
import {
  projectTranscriptToBubbles,
  type ReviewAnchor,
} from './ai-agent-history.projection'
import { stripSystemReminder } from './ai-agent-vfs'

export interface StoredReviewState {
  reviewState: Record<string, unknown> | null
  anchors: ReviewAnchor[]
}

const notFound = () =>
  createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
    message: 'Conversation not found',
  })

const textOf = (content: PiMessage['content']) =>
  typeof content === 'string'
    ? content
    : content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')

export function firstExchangeOf(
  messages: readonly PiMessage[],
): { user: string; assistant: string } | null {
  const user = messages.find((message) => message.role === 'user')
  const assistant = messages.find(
    (message) => message.role === 'assistant' && textOf(message.content).trim(),
  )
  if (!user || !assistant) return null
  return {
    user: stripSystemReminder(textOf(user.content)),
    assistant: textOf(assistant.content),
  }
}

@Injectable()
export class AiAgentConversationService {
  private readonly logger = new Logger(AiAgentConversationService.name)

  constructor(
    private readonly conversationRepository: AiAgentConversationRepository,
    private readonly configService: ConfigsService,
  ) {}

  async create(data: { sessionId: string; model: string; providerId: string }) {
    return this.conversationRepository.create(data)
  }

  async listBySession(sessionId: string) {
    return this.conversationRepository.listBySession(sessionId)
  }

  async getDetail(id: string) {
    const row = await this.conversationRepository.findDetail(id)
    if (!row) throw notFound()
    const { transcript, reviewState, ...meta } = row
    const stored = reviewState as StoredReviewState | null
    const anchors = stored?.anchors ?? []
    return {
      ...meta,
      bubbles: projectTranscriptToBubbles(
        ((transcript as { messages?: PiMessage[] }).messages ??
          []) as PiMessage[],
        anchors,
      ),
      reviewState: stored?.reviewState ?? null,
      anchors,
    }
  }

  async saveReviewState(id: string, state: StoredReviewState) {
    const saved = await this.conversationRepository.saveReviewState(
      id,
      state as unknown as Record<string, unknown>,
    )
    if (!saved) throw notFound()
  }

  async updateById(id: string, data: { sessionId?: string }) {
    const result = await this.conversationRepository.update(id, data)
    if (!result) throw notFound()
    return result
  }

  async deleteById(id: string) {
    await this.conversationRepository.deleteById(id)
  }

  async generateAndPersistTitle(id: string) {
    const row = await this.conversationRepository.findDetail(id)
    if (!row) throw notFound()
    const { transcript, reviewState: _reviewState, ...meta } = row
    if (meta.title) return meta

    const exchange = firstExchangeOf(
      ((transcript as { messages?: PiMessage[] }).messages ??
        []) as PiMessage[],
    )
    if (!exchange) return meta
    const title = await this.generateTitle(
      exchange,
      meta.model,
      meta.providerId,
    )
    if (!title) return meta
    return (await this.conversationRepository.update(id, { title })) ?? meta
  }

  async generateTitle(
    exchange: { user: string; assistant: string },
    model: string,
    providerId: string,
  ): Promise<string | null> {
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
            content: exchange.user.slice(0, 500),
          },
          {
            role: 'assistant',
            content: exchange.assistant.slice(0, 500),
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
