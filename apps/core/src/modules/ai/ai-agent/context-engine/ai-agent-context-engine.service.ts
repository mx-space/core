import type { AgentMessage } from '@mariozechner/pi-agent-core'
import { Injectable } from '@nestjs/common'

import { InjectModel } from '~/transformers/model.transformer'

import { AIAgentMessageModel } from '../ai-agent-message.model'

interface BuildContextInput {
  sessionId: string
  historyWindow: number
  contextCharBudget: number
}

interface BuildContextResult {
  compressed: boolean
  messages: AgentMessage[]
  summary?: string
}

@Injectable()
export class AIAgentContextEngineService {
  constructor(
    @InjectModel(AIAgentMessageModel)
    private readonly messageModel: MongooseModel<AIAgentMessageModel>,
  ) {}

  async buildContext(input: BuildContextInput): Promise<BuildContextResult> {
    const docs = await this.messageModel
      .find({ sessionId: input.sessionId })
      .sort({ seq: 1 })
      .lean()

    const normalized: AgentMessage[] = []
    for (const doc of docs) {
      const message = (doc.content as any)?.message
      if (!message || typeof message !== 'object') {
        continue
      }
      if (
        message.role === 'user' ||
        message.role === 'assistant' ||
        message.role === 'toolResult'
      ) {
        normalized.push(message as AgentMessage)
      }
    }

    const maxMessages = Math.max(10, input.historyWindow)
    let selected = normalized.slice(-maxMessages)

    const textSize = this.estimateChars(selected)
    if (
      textSize <= input.contextCharBudget ||
      normalized.length <= selected.length
    ) {
      return {
        compressed: false,
        messages: selected,
      }
    }

    const overflowCount = normalized.length - selected.length
    const overflowMessages = normalized.slice(0, overflowCount)
    const summary = this.summarizeMessages(overflowMessages)

    const summaryMessage: AgentMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Previous conversation summary (auto-compressed):\n${summary}`,
        },
      ],
      timestamp: Date.now(),
    }

    selected = [summaryMessage, ...selected]

    return {
      compressed: true,
      messages: selected,
      summary,
    }
  }

  private estimateChars(messages: AgentMessage[]) {
    let total = 0
    for (const message of messages) {
      const content = (message as any).content
      if (!Array.isArray(content)) {
        continue
      }
      for (const item of content) {
        if (item?.type === 'text' && typeof item.text === 'string') {
          total += item.text.length
        }
      }
    }
    return total
  }

  private summarizeMessages(messages: AgentMessage[]) {
    const lines: string[] = []
    for (const message of messages.slice(-30)) {
      const role = (message as any).role
      const text = this.pickText(message)
      if (!text) {
        continue
      }
      lines.push(`[${role}] ${text}`)
      if (lines.length >= 30) {
        break
      }
    }

    const summary = lines.join('\n')
    if (summary.length <= 8_000) {
      return summary
    }

    return `${summary.slice(0, 8_000)}\n...<truncated>`
  }

  private pickText(message: AgentMessage) {
    const content = (message as any).content
    if (!Array.isArray(content)) {
      return ''
    }

    return content
      .filter((item) => item?.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .slice(0, 300)
  }
}
