/* eslint-disable unicorn/better-regex */
import { Logger } from '@nestjs/common'
import JSON5 from 'json5'

import { extractFirstJsonObject } from '~/utils/json.util'

import { AI_PROMPTS } from '../../ai.prompts'
import type { IModelRuntime } from '../../runtime'

export abstract class BaseTranslationStrategy {
  protected readonly logger: Logger

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext)
  }

  protected parseModelJson<T extends Record<string, any>>(
    rawText: string,
    context: string,
  ): T {
    const trimmed = rawText.trim()
    const candidates = new Set<string>()

    const addCandidate = (value: string | null | undefined) => {
      if (!value) return
      const text = value.trim()
      if (!text) return
      candidates.add(text)
    }

    addCandidate(trimmed)

    const codeFenceMatch = trimmed.match(
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/,
    )
    addCandidate(codeFenceMatch?.[1])
    addCandidate(extractFirstJsonObject(trimmed))
    if (codeFenceMatch?.[1]) {
      addCandidate(extractFirstJsonObject(codeFenceMatch[1]))
    }

    let lastError: unknown

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T
      } catch (error) {
        // eslint-disable-next-line no-useless-assignment
        lastError = error
      }
      try {
        return JSON5.parse(candidate) as T
      } catch (error) {
        lastError = error
      }
    }

    this.logger.warn(
      `${context}: failed to parse model JSON. length=${rawText.length} head=${JSON.stringify(
        trimmed.slice(0, 240),
      )} tail=${JSON.stringify(trimmed.slice(-240))}`,
    )

    throw new Error(
      `${context}: invalid JSON output (${
        lastError instanceof Error ? lastError.message : String(lastError)
      })`,
    )
  }

  protected async callChunkTranslation(
    targetLang: string,
    chunk: {
      documentContext: string
      textEntries: Record<string, string>
      segmentMeta?: Record<string, string>
    },
    runtime: IModelRuntime,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ sourceLang: string; translations: Record<string, string> }> {
    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationChunk(targetLang, chunk)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const c of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })) {
        if (signal?.aborted) {
          throw Object.assign(new Error('Task aborted'), { name: 'AbortError' })
        }
        fullText += c.text
        if (onToken) await onToken()
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
    }

    return this.parseModelJson<{
      sourceLang: string
      translations: Record<string, string>
    }>(fullText, 'callChunkTranslation')
  }
}
