import { Injectable, Logger } from '@nestjs/common'
import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'
import type { z } from 'zod'

import { extractFirstJsonObject } from '~/utils/json.util'

import { AI_PROMPTS } from '../ai.prompts'
import type { IModelRuntime } from '../runtime'

export interface ReviewerIssue {
  id: string
  severity: 'minor' | 'major'
  problem: string
  hint?: string
}

export interface ReviewerOutput {
  score: number
  issues: ReviewerIssue[]
}

export interface EditorOutput {
  patches: Record<string, string>
}

function stripCodeFence(input: string): string {
  if (!input.startsWith('```')) return input
  const newlineIndex = input.indexOf('\n')
  if (newlineIndex === -1) return input
  const opener = input.slice(0, newlineIndex).trim()
  if (opener !== '```' && opener !== '```json' && opener !== '```JSON') {
    return input
  }
  const body = input.slice(newlineIndex + 1)
  const closing = body.lastIndexOf('```')
  if (closing === -1) return body
  return body.slice(0, closing).trim()
}

function parseLooseJson<T>(text: string): T | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const candidates: string[] = [trimmed]
  const unfenced = stripCodeFence(trimmed)
  if (unfenced !== trimmed) candidates.push(unfenced)
  const extracted = extractFirstJsonObject(trimmed)
  if (extracted) candidates.push(extracted)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      /* try next strategy */
    }
    try {
      return JSON5.parse(candidate) as T
    } catch {
      /* try next strategy */
    }
    try {
      return JSON.parse(jsonrepair(candidate)) as T
    } catch {
      /* try next strategy */
    }
  }
  return null
}

@Injectable()
export class TranslationReviewerService {
  private readonly logger = new Logger(TranslationReviewerService.name)

  async callReviewer(
    runtime: IModelRuntime,
    targetLang: string,
    payload: {
      allowedIds: string[]
      fullTranslations: Record<string, string>
    },
    signal?: AbortSignal,
  ): Promise<ReviewerOutput | null> {
    const { systemPrompt, prompt, schema, reasoningEffort } =
      AI_PROMPTS.translationReviewer(targetLang, payload)

    const tryStructured = async (): Promise<ReviewerOutput | null> => {
      if (typeof runtime.generateStructured !== 'function') return null
      try {
        const result = await runtime.generateStructured({
          systemPrompt,
          prompt,
          schema,
          reasoningEffort,
          signal,
        })
        return schema.parse(result.output) as ReviewerOutput
      } catch (error) {
        this.logger.warn(
          `Reviewer structured output failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      }
    }

    const tryText = async (): Promise<ReviewerOutput | null> => {
      try {
        const result = await runtime.generateText({
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: prompt },
          ],
          temperature: 0.2,
          maxRetries: 1,
          reasoningEffort,
          signal,
        })
        const parsed = parseLooseJson<unknown>(result.text)
        if (!parsed) return null
        return schema.parse(parsed) as ReviewerOutput
      } catch (error) {
        this.logger.warn(
          `Reviewer text-mode call/parse failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      }
    }

    const structured = await tryStructured()
    if (structured) {
      return this.sanitize(structured, payload.allowedIds)
    }

    const text = await tryText()
    if (text) {
      return this.sanitize(text, payload.allowedIds)
    }

    return null
  }

  private sanitize(
    review: ReviewerOutput,
    allowedIds: string[],
  ): ReviewerOutput {
    const allowedSet = new Set(allowedIds)
    const filteredIssues = review.issues.filter((issue) => {
      if (!allowedSet.has(issue.id)) {
        this.logger.debug(
          `Reviewer issue id '${issue.id}' not in ALLOWED_IDS, dropping`,
        )
        return false
      }
      return true
    })

    return {
      score: Math.max(0, Math.min(100, Math.round(review.score))),
      issues: filteredIssues,
    }
  }
}

export type ReviewerSchema = ReturnType<
  typeof AI_PROMPTS.translationReviewer
>['schema']
export type EditorSchema = ReturnType<
  typeof AI_PROMPTS.translationEditor
>['schema']

export type ReviewerSchemaType = z.infer<ReviewerSchema>
export type EditorSchemaType = z.infer<EditorSchema>

export const __test_only__ = { parseLooseJson }
