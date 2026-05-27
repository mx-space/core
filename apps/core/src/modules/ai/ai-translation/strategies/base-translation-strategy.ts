/* eslint-disable unicorn/better-regex */
import { Logger } from '@nestjs/common'
import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'

import { throwIfAborted } from '~/utils/abort.util'
import {
  extractFirstJsonObject,
  extractLastJsonObject,
} from '~/utils/json.util'

import { AI_PROMPTS } from '../../ai.prompts'
import type { IModelRuntime } from '../../runtime'
import type {
  PipelineEditorMetrics,
  PipelineReviewerMetrics,
} from '../translation-strategy.interface'

export const DEFAULT_REVIEW_SCORE_THRESHOLD = 85

export function emptyReviewerMetrics(
  skippedReason: string,
): PipelineReviewerMetrics {
  return {
    invoked: false,
    durationMs: 0,
    skippedReason,
    score: null,
    issuesCount: 0,
    issuesBySeverity: { minor: 0, major: 0 },
    issueIds: [],
    issues: [],
  }
}

export function emptyEditorMetrics(
  skippedReason: string,
): PipelineEditorMetrics {
  return {
    invoked: false,
    durationMs: 0,
    skippedReason,
    patchKeysRequested: [],
    patchKeysApplied: [],
    patchKeysDropped: [],
    patches: [],
  }
}

export function buildReviewerMetrics(
  durationMs: number,
  review: {
    score: number
    issues: PipelineReviewerMetrics['issues']
  },
): PipelineReviewerMetrics {
  return {
    invoked: true,
    durationMs,
    skippedReason: null,
    score: review.score,
    issuesCount: review.issues.length,
    issuesBySeverity: {
      minor: review.issues.filter((i) => i.severity === 'minor').length,
      major: review.issues.filter((i) => i.severity === 'major').length,
    },
    issueIds: review.issues.map((i) => i.id),
    issues: review.issues,
  }
}

export abstract class BaseTranslationStrategy {
  protected readonly logger: Logger

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext)
  }

  private repairCommonJsonStringIssues(input: string): string {
    type ContainerState =
      | {
          type: 'object'
          expectingKey: boolean
        }
      | {
          type: 'array'
        }

    const peekNextSignificant = (start: number) => {
      let index = start
      while (index < input.length && /\s/.test(input[index])) index++
      return {
        char: input[index],
        index,
      }
    }

    const findLikelyStringEnd = (startQuoteIndex: number) => {
      let escaping = false
      for (let i = startQuoteIndex + 1; i < input.length; i++) {
        const char = input[i]
        if (escaping) {
          escaping = false
          continue
        }
        if (char === '\\') {
          escaping = true
          continue
        }
        if (char === '"') {
          return i
        }
      }
      return -1
    }

    const looksLikeObjectKeyAfterComma = (quoteIndex: number) => {
      const endQuoteIndex = findLikelyStringEnd(quoteIndex)
      if (endQuoteIndex === -1) return false
      const afterKey = peekNextSignificant(endQuoteIndex + 1)
      return afterKey.char === ':'
    }

    const looksLikeValueStringTerminator = (
      quoteIndex: number,
      container: ContainerState | undefined,
    ) => {
      const next = peekNextSignificant(quoteIndex + 1)

      if (next.char === '}' || next.char === ']' || next.char === undefined) {
        return true
      }

      if (next.char === ',') {
        const afterComma = peekNextSignificant(next.index + 1)
        if (container?.type === 'object') {
          return (
            afterComma.char === '"' &&
            looksLikeObjectKeyAfterComma(afterComma.index)
          )
        }
        if (container?.type === 'array') {
          return afterComma.char !== undefined
        }
      }

      return false
    }

    let result = ''
    const containerStack: ContainerState[] = []
    let inString = false
    let stringKind: 'key' | 'value' = 'value'
    let escaping = false

    for (let i = 0; i < input.length; i++) {
      const char = input[i]

      if (!inString) {
        result += char
        if (char === '{') {
          containerStack.push({ type: 'object', expectingKey: true })
          continue
        }
        if (char === '[') {
          containerStack.push({ type: 'array' })
          continue
        }
        if (char === '}' || char === ']') {
          containerStack.pop()
          continue
        }
        if (char === ',') {
          const current = containerStack.at(-1)
          if (current?.type === 'object') {
            current.expectingKey = true
          }
          continue
        }
        if (char === ':') {
          const current = containerStack.at(-1)
          if (current?.type === 'object') {
            current.expectingKey = false
          }
          continue
        }
        if (char === '"') {
          inString = true
          const current = containerStack.at(-1)
          stringKind =
            current?.type === 'object' && current.expectingKey ? 'key' : 'value'
        }
        continue
      }

      if (escaping) {
        result += char
        escaping = false
        continue
      }

      if (char === '\\') {
        result += char
        escaping = true
        continue
      }

      if (char === '"') {
        const current = containerStack.at(-1)
        const isTerminator =
          stringKind === 'key'
            ? peekNextSignificant(i + 1).char === ':'
            : looksLikeValueStringTerminator(i, current)

        if (!isTerminator) {
          result += '\\"'
          continue
        }

        result += char
        inString = false
        stringKind = 'value'
        continue
      }

      result += char
    }

    return result
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
    addCandidate(extractLastJsonObject(trimmed))
    if (codeFenceMatch?.[1]) {
      addCandidate(extractFirstJsonObject(codeFenceMatch[1]))
    }

    let lastError: unknown
    const tryParse = <R>(parser: () => R): R | undefined => {
      try {
        return parser()
      } catch (error) {
        lastError = error
        return undefined
      }
    }

    for (const candidate of candidates) {
      const parsedJson = tryParse(() => JSON.parse(candidate) as T)
      if (parsedJson !== undefined) {
        return parsedJson
      }

      const parsedJson5 = tryParse(() => JSON5.parse(candidate) as T)
      if (parsedJson5 !== undefined) {
        return parsedJson5
      }

      const heuristicCandidate = this.repairCommonJsonStringIssues(candidate)
      if (heuristicCandidate !== candidate) {
        const repairedJson = tryParse(() => {
          this.logger.warn(`${context}: repaired malformed model JSON`)
          return JSON.parse(heuristicCandidate) as T
        })
        if (repairedJson !== undefined) {
          return repairedJson
        }

        const repairedJson5 = tryParse(
          () => JSON5.parse(heuristicCandidate) as T,
        )
        if (repairedJson5 !== undefined) {
          return repairedJson5
        }
      }

      const repairedCandidateJson = tryParse(() => {
        const repairedCandidate = jsonrepair(heuristicCandidate)
        if (repairedCandidate !== candidate) {
          this.logger.warn(
            `${context}: repaired malformed model JSON via jsonrepair`,
          )
        }
        return JSON.parse(repairedCandidate) as T
      })
      if (repairedCandidateJson !== undefined) {
        return repairedCandidateJson
      }

      const repairedCandidateJson5 = tryParse(
        () => JSON5.parse(jsonrepair(heuristicCandidate)) as T,
      )
      if (repairedCandidateJson5 !== undefined) {
        return repairedCandidateJson5
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

  private parseNestedJsonValue(rawText: string, context: string): unknown {
    const trimmed = rawText.trim()

    try {
      return JSON.parse(trimmed)
    } catch {
      // Ignore and continue with more tolerant parsers.
    }

    try {
      return JSON5.parse(trimmed)
    } catch {
      // Ignore and continue with more tolerant parsers.
    }

    const heuristicCandidate = this.repairCommonJsonStringIssues(trimmed)
    if (heuristicCandidate !== trimmed) {
      try {
        this.logger.warn(`${context}: repaired nested malformed model JSON`)
        return JSON.parse(heuristicCandidate)
      } catch {
        // Ignore and continue with more tolerant parsers.
      }

      try {
        return JSON5.parse(heuristicCandidate)
      } catch {
        // Ignore and continue with more tolerant parsers.
      }
    }

    const repairedCandidate = jsonrepair(heuristicCandidate)
    if (repairedCandidate !== trimmed) {
      this.logger.warn(
        `${context}: repaired nested malformed model JSON via jsonrepair`,
      )
    }

    try {
      return JSON.parse(repairedCandidate)
    } catch {
      // Ignore and continue with the final JSON5 parser.
    }

    return JSON5.parse(repairedCandidate)
  }

  private normalizeTranslationTree(value: unknown, context: string): unknown {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return value
      }

      try {
        return this.normalizeTranslationTree(
          this.parseNestedJsonValue(trimmed, context),
          context,
        )
      } catch {
        return value
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeTranslationTree(item, context))
    }

    if (!value || typeof value !== 'object') {
      return value
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        this.normalizeTranslationTree(child, context),
      ]),
    )
  }

  private normalizeChunkTranslationResponse<T>(value: T): T {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value
    }

    const chunkResponse = value as Record<string, unknown>
    return {
      ...chunkResponse,
      translations: this.normalizeTranslationTree(
        chunkResponse.translations,
        'callWriter',
      ),
    } as T
  }

  protected async callWriter(
    targetLang: string,
    payload: {
      documentContext: string
      textEntries: Record<string, unknown>
      segmentMeta?: Record<string, string>
    },
    runtime: IModelRuntime,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<{
    sourceLang: string
    translations: Record<string, string | Record<string, string>>
  }> {
    type WriterResult = {
      sourceLang: string
      translations: Record<string, string | Record<string, string>>
    }

    const { systemPrompt, prompt, schema, reasoningEffort } =
      AI_PROMPTS.translationChunk(targetLang, payload)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    if (typeof runtime.generateStructured === 'function') {
      try {
        const result = await runtime.generateStructured({
          prompt,
          systemPrompt,
          schema,
          reasoningEffort,
          signal,
        })
        return schema.parse(
          this.normalizeChunkTranslationResponse(result.output),
        ) as WriterResult
      } catch (error) {
        this.logger.warn(
          `callWriter: structured output failed, falling back to text mode (${
            error instanceof Error ? error.message : String(error)
          })`,
        )
      }
    }

    let fullText = ''
    if (runtime.generateTextStream) {
      for await (const c of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })) {
        throwIfAborted(signal)
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

    return schema.parse(
      this.normalizeChunkTranslationResponse(
        this.parseModelJson<WriterResult>(fullText, 'callWriter'),
      ),
    ) as WriterResult
  }

  protected async callEditor(
    targetLang: string,
    payload: {
      fullTranslations: Record<string, string>
      issues: Array<{
        id: string
        severity: 'minor' | 'major'
        problem: string
        hint?: string
      }>
    },
    runtime: IModelRuntime,
    signal?: AbortSignal,
  ): Promise<{ patches: Record<string, string> } | null> {
    const { systemPrompt, prompt, schema, reasoningEffort } =
      AI_PROMPTS.translationEditor(targetLang, payload)

    if (typeof runtime.generateStructured === 'function') {
      try {
        const result = await runtime.generateStructured({
          systemPrompt,
          prompt,
          schema,
          reasoningEffort,
          signal,
        })
        return schema.parse(result.output) as {
          patches: Record<string, string>
        }
      } catch (error) {
        this.logger.warn(
          `callEditor: structured output failed, falling back to text mode (${
            error instanceof Error ? error.message : String(error)
          })`,
        )
      }
    }

    try {
      const result = await runtime.generateText({
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt },
        ],
        temperature: 0.3,
        maxRetries: 1,
        reasoningEffort,
        signal,
      })
      const parsed = this.parseModelJson<{ patches: Record<string, string> }>(
        result.text,
        'callEditor',
      )
      return schema.parse(parsed) as { patches: Record<string, string> }
    } catch (error) {
      this.logger.warn(
        `callEditor failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }
}
