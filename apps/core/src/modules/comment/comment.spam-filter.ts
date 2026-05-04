import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'

import { hasChinese } from '~/utils/tool.util'

import { AI_PROMPTS } from '../ai/ai.prompts'
import { AiService } from '../ai/ai.service'
import { ConfigsService } from '../configs/configs.service'
import { OwnerService } from '../owner/owner.service'
import BlockedKeywords from './block-keywords.json' with { type: 'json' }
import type { CommentModel } from './comment.types'
import MeaninglessWords from './meaningless-words.json' with { type: 'json' }

export interface SpamFilterContext {
  doc: CommentModel
  commentOptions: {
    blockIps?: string[]
    spamKeywords?: string[]
    disableNoChinese?: boolean
    aiReview?: boolean
    aiReviewType: 'binary' | 'score'
    aiReviewThreshold: number
  }
}

export interface SpamFilterResult {
  isSpam: boolean
  reason?: string
}

export type SpamFilter = (
  ctx: SpamFilterContext,
) => Promise<SpamFilterResult> | SpamFilterResult

function testKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => new RegExp(kw, 'gi').test(text))
}

const meaninglessWordsSet = new Set(
  MeaninglessWords.map((w) => w.trim().toLowerCase()),
)

const meaninglessContentFilter: SpamFilter = ({ doc }) => {
  const trimmed = doc.text.trim()
  if (!trimmed) return { isSpam: false }
  const normalized = trimmed.toLowerCase()
  const hit = meaninglessWordsSet.has(normalized)
  return { isSpam: hit, reason: hit ? 'meaningless-content' : undefined }
}

const builtinKeywordsFilter: SpamFilter = ({ doc }) => {
  const hit = testKeywords(doc.text, BlockedKeywords)
  return { isSpam: hit, reason: hit ? 'builtin-keyword' : undefined }
}

const systemSettingsFilter: SpamFilter = ({ doc, commentOptions }) => {
  if (commentOptions.blockIps?.length && doc.ip) {
    const blocked = commentOptions.blockIps.some((ip) =>
      new RegExp(ip, 'gi').test(doc.ip!),
    )
    if (blocked) return { isSpam: true, reason: 'blocked-ip' }
  }

  const custom = commentOptions.spamKeywords || []
  if (custom.length && testKeywords(doc.text, custom)) {
    return { isSpam: true, reason: 'custom-keyword' }
  }

  if (commentOptions.disableNoChinese && !hasChinese(doc.text)) {
    return { isSpam: true, reason: 'no-chinese' }
  }

  return { isSpam: false }
}

@Injectable()
export class CommentSpamFilterService {
  private readonly logger = new Logger(CommentSpamFilterService.name)

  constructor(
    private readonly configsService: ConfigsService,
    private readonly ownerService: OwnerService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {}

  async checkSpam(doc: CommentModel): Promise<boolean> {
    const commentOptions = await this.configsService.get('commentOptions')
    if (!commentOptions.antiSpam) return false

    const owner = await this.ownerService.getOwner()
    if (doc.author === owner.username || doc.author === owner.name) return false

    const filters: SpamFilter[] = [
      meaninglessContentFilter,
      builtinKeywordsFilter,
      systemSettingsFilter,
      this.createAiReviewFilter(),
    ]

    const result = await this.runPipeline(filters, { doc, commentOptions })

    if (result.isSpam) {
      this.logger.warn(
        `--> 检测到垃圾评论 [${result.reason}]：` +
          `作者：${doc.author}, IP: ${doc.ip}, 内容：${doc.text}`,
      )
    }
    return result.isSpam
  }

  private createAiReviewFilter(): SpamFilter {
    return async ({ doc, commentOptions }) => {
      if (!commentOptions.aiReview) return { isSpam: false }
      const isSpam = await this.evaluateWithAI(
        doc.text,
        commentOptions.aiReviewType,
        commentOptions.aiReviewThreshold,
      )
      return { isSpam, reason: isSpam ? 'ai-review' : undefined }
    }
  }

  async evaluateWithAI(
    text: string,
    aiReviewType: 'binary' | 'score',
    aiReviewThreshold: number,
  ): Promise<boolean> {
    const runtime = await this.aiService.getCommentReviewModel()

    if (aiReviewType === 'score') {
      try {
        const { output } = await runtime.generateStructured({
          ...AI_PROMPTS.comment.score(text),
        })

        if (output.hasSensitiveContent) {
          return true
        }
        return output.score > aiReviewThreshold
      } catch (error) {
        this.logger.error('AI 评审评分模式出错', error)
        return false
      }
    } else {
      try {
        const { output } = await runtime.generateStructured({
          ...AI_PROMPTS.comment.spam(text),
        })

        if (output.hasSensitiveContent) {
          return true
        }
        return output.isSpam
      } catch (error) {
        this.logger.error('AI 评审垃圾检测模式出错', error)
        return false
      }
    }
  }

  private async runPipeline(
    filters: SpamFilter[],
    ctx: SpamFilterContext,
  ): Promise<SpamFilterResult> {
    for (const filter of filters) {
      const result = await filter(ctx)
      if (result.isSpam) return result
    }
    return { isSpam: false }
  }
}
