import { Injectable } from '@nestjs/common'

import { AI_PROMPTS } from '../../ai.prompts'
import type { IModelRuntime } from '../../runtime'
import type { ArticleContent } from '../ai-translation.types'
import type {
  ITranslationStrategy,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import { BaseTranslationStrategy } from './base-translation-strategy'

@Injectable()
export class MarkdownTranslationStrategy
  extends BaseTranslationStrategy
  implements ITranslationStrategy
{
  constructor() {
    super(MarkdownTranslationStrategy.name)
  }

  async translate(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    options: TranslationStrategyOptions,
  ): Promise<TranslationResult> {
    const { push, onToken, signal } = options

    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationStream(targetLang, {
        title: content.title,
        text: content.text,
        summary: content.summary ?? undefined,
        tags: content.tags,
      })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const chunk of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })) {
        if (signal?.aborted) {
          throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
        }
        fullText += chunk.text
        if (push) {
          await push({ type: 'token', data: chunk.text })
        }
        if (onToken) {
          await onToken()
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })
      fullText = result.text
      if (push && result.text) {
        await push({ type: 'token', data: result.text })
      }
      if (onToken && result.text) {
        await onToken()
      }
    }

    const parsed = this.parseModelJson<{
      sourceLang?: string
      title?: string
      text?: string
      summary?: string | null
      tags?: string[] | null
    }>(fullText, 'translateMarkdownContent')

    if (!parsed?.title || !parsed?.text || !parsed?.sourceLang) {
      throw new Error('Invalid translation JSON response')
    }

    return {
      sourceLang: parsed.sourceLang,
      title: parsed.title,
      text: parsed.text,
      summary: parsed.summary ?? null,
      tags: parsed.tags ?? null,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }
}
