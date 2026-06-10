/* eslint-disable unicorn/better-regex */
import type { TSchema } from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'
import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'
import { Value } from 'typebox/value'

import { throwIfAborted } from '~/utils/abort.util'
import {
  extractFirstJsonObject,
  extractLastJsonObject,
} from '~/utils/json.util'

import { AI_PROMPTS } from '../../ai.prompts'
import type { IModelRuntime } from '../../runtime'
import type { TranslationReviewerService } from '../reviewer.service'
import type {
  PipelineEditorMetrics,
  PipelineMetrics,
  PipelineReviewerMetrics,
} from '../translation-strategy.interface'

export function firstValidationFailure(
  schema: TSchema,
  value: unknown,
): string {
  const [first] = [...Value.Errors(schema, value)]
  if (!first) return 'unknown validation failure'
  return `${first.instancePath || '/'}: ${first.message}`
}

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

  // Tolerant parse of a single candidate string: JSON → JSON5 → heuristic
  // string repair → jsonrepair. Throws if every parser fails.
  private parseCandidateTolerantly(
    candidate: string,
    context: string,
  ): unknown {
    try {
      return JSON.parse(candidate)
    } catch {
      // Ignore and continue with more tolerant parsers.
    }

    try {
      return JSON5.parse(candidate)
    } catch {
      // Ignore and continue with more tolerant parsers.
    }

    const heuristicCandidate = this.repairCommonJsonStringIssues(candidate)
    if (heuristicCandidate !== candidate) {
      try {
        const parsed = JSON.parse(heuristicCandidate)
        this.logger.warn(`${context}: repaired malformed model JSON`)
        return parsed
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
    if (repairedCandidate !== candidate) {
      this.logger.warn(
        `${context}: repaired malformed model JSON via jsonrepair`,
      )
    }

    try {
      return JSON.parse(repairedCandidate)
    } catch {
      // Ignore and continue with the final JSON5 parser.
    }

    return JSON5.parse(repairedCandidate)
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
    for (const candidate of candidates) {
      try {
        return this.parseCandidateTolerantly(candidate, context) as T
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

  private parseNestedJsonValue(rawText: string, context: string): unknown {
    return this.parseCandidateTolerantly(rawText.trim(), context)
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

  protected async callWriterStreaming(
    targetLang: string,
    payload: {
      documentContext: string
      textEntries: Record<string, unknown>
      segmentMeta?: Record<string, string>
    },
    runtime: IModelRuntime,
    onPartial?: (partial: unknown) => void | Promise<void>,
    onToken?: (count?: number) => Promise<void>,
    signal?: AbortSignal,
    onCost?: (usd: number) => Promise<void>,
  ): Promise<{
    sourceLang: string
    translations: Record<string, string | Record<string, string>>
  }> {
    type WriterResult = {
      sourceLang: string
      translations: Record<string, string | Record<string, string>>
    }

    if (typeof runtime.streamStructured !== 'function') {
      return this.callWriter(
        targetLang,
        payload,
        runtime,
        onToken,
        signal,
        onCost,
      )
    }

    const { systemPrompt, prompt, schema, reasoningEffort } =
      AI_PROMPTS.translationChunk(targetLang, payload)

    let final: WriterResult | undefined
    let sawDone = false
    let totalCost = 0
    try {
      for await (const chunk of runtime.streamStructured({
        prompt,
        systemPrompt,
        schema,
        reasoningEffort,
        signal,
        validate: false,
      })) {
        throwIfAborted(signal)
        if (chunk.partial !== undefined) {
          try {
            await onPartial?.(chunk.partial)
          } catch (cbErr) {
            this.logger.warn(
              `callWriterStreaming: onPartial callback threw (${
                cbErr instanceof Error ? cbErr.message : String(cbErr)
              })`,
            )
          }
        }
        if (chunk.done) {
          sawDone = true
          if (chunk.final !== undefined) {
            const normalised = this.normalizeChunkTranslationResponse(
              chunk.final as WriterResult,
            )
            if (!Value.Check(schema, normalised)) {
              throw new Error(
                `callWriterStreaming: translation chunk validation failed at ${firstValidationFailure(schema, normalised)}`,
              )
            }
            final = normalised as WriterResult
          }
          if (chunk.usage?.cost !== undefined) totalCost = chunk.usage.cost
        }
        if (onToken) await onToken()
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error
      const message: string =
        error instanceof Error ? error.message : String(error)
      if (error instanceof TypeError || /not supported/i.test(message)) {
        this.logger.warn(`streamStructured fallback: ${message}`)
        return this.callWriter(
          targetLang,
          payload,
          runtime,
          onToken,
          signal,
          onCost,
        )
      }
      throw error
    }

    if (onCost && totalCost > 0) {
      await onCost(totalCost)
    }

    if (!sawDone || final === undefined) {
      throw new Error(
        'callWriterStreaming: stream ended without a terminal chunk',
      )
    }

    return final
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
    onCost?: (usd: number) => Promise<void>,
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
          validate: false,
        })
        const normalised = this.normalizeChunkTranslationResponse(result.output)
        if (!Value.Check(schema, normalised)) {
          throw new Error(
            `callWriter: translation chunk validation failed at ${firstValidationFailure(schema, normalised)}`,
          )
        }
        if (onCost && result.usage?.cost && result.usage.cost > 0) {
          await onCost(result.usage.cost)
        }
        return normalised as WriterResult
      } catch (error) {
        this.logger.warn(
          `callWriter: structured output failed, falling back to text mode (${
            error instanceof Error ? error.message : String(error)
          })`,
        )
      }
    }

    let fullText = ''
    // NOTE: generateTextStream path is usage-blind (pi adapter does not surface
    // usage frames on this stream type) — onCost intentionally not invoked here.
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
      if (onCost && result.usage?.cost && result.usage.cost > 0) {
        await onCost(result.usage.cost)
      }
    }

    const normalisedFallback = this.normalizeChunkTranslationResponse(
      this.parseModelJson<WriterResult>(fullText, 'callWriter'),
    )
    if (!Value.Check(schema, normalisedFallback)) {
      throw new Error(
        `callWriter: translation chunk validation failed at ${firstValidationFailure(schema, normalisedFallback)}`,
      )
    }
    return normalisedFallback as WriterResult
  }

  // Shared reviewer → editor orchestration. Strategy-specific patch
  // application is injected via `applyPatches`, which is only invoked when
  // the editor produced output.
  protected async runReviewAndEditPipeline(opts: {
    targetLang: string
    translatorRuntime: IModelRuntime
    reviewerRuntime: IModelRuntime
    reviewerService: TranslationReviewerService
    fullTranslations: Record<string, string>
    allowedIds: readonly string[]
    scoreThreshold: number
    signal?: AbortSignal
    metrics?: PipelineMetrics
    applyPatches: (patches: Record<string, string>) => {
      patchKeysApplied: string[]
      patchKeysDropped: string[]
      patches: Array<{ id: string; before: string; after: string }>
    }
  }): Promise<void> {
    const {
      targetLang,
      translatorRuntime,
      reviewerRuntime,
      reviewerService,
      fullTranslations,
      allowedIds,
      scoreThreshold,
      signal,
      metrics,
      applyPatches,
    } = opts

    const reviewerStart = Date.now()
    const review = await reviewerService.callReviewer(
      reviewerRuntime,
      targetLang,
      { allowedIds: [...allowedIds], fullTranslations },
      signal,
    )
    const reviewerMs = Date.now() - reviewerStart

    if (!review) {
      this.logger.warn('Reviewer returned null; persisting writer output as-is')
      if (metrics) {
        metrics.reviewer = {
          ...emptyReviewerMetrics('reviewer-failed'),
          invoked: true,
          durationMs: reviewerMs,
        }
        metrics.editor = emptyEditorMetrics('reviewer-failed')
      }
      return
    }

    if (review.score >= scoreThreshold || review.issues.length === 0) {
      this.logger.log(
        `Review pass: score=${review.score} issues=${review.issues.length}; edit skipped`,
      )
      if (metrics) {
        metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
        metrics.editor = emptyEditorMetrics(
          review.issues.length === 0 ? 'empty-issues' : 'score-above-threshold',
        )
      }
      return
    }

    const editorStart = Date.now()
    const editor = await this.callEditor(
      targetLang,
      { fullTranslations, issues: review.issues },
      translatorRuntime,
      signal,
    )
    const editorMs = Date.now() - editorStart

    if (!editor) {
      this.logger.warn('Editor returned null; persisting writer output as-is')
      if (metrics) {
        metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
        metrics.editor = {
          ...emptyEditorMetrics('editor-failed'),
          durationMs: editorMs,
        }
      }
      return
    }

    const patchKeysRequested = Object.keys(editor.patches)
    const { patchKeysApplied, patchKeysDropped, patches } = applyPatches(
      editor.patches,
    )

    if (patchKeysDropped.length > 0) {
      this.logger.warn(
        `Editor produced ${patchKeysDropped.length} out-of-set patches: ${patchKeysDropped.slice(0, 5).join(', ')}`,
      )
    }
    this.logger.log(
      `Edit applied: ${patchKeysApplied.length}/${review.issues.length} issues addressed`,
    )

    if (metrics) {
      metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
      metrics.editor = {
        invoked: true,
        durationMs: editorMs,
        skippedReason: null,
        patchKeysRequested,
        patchKeysApplied,
        patchKeysDropped,
        patches,
      }
    }
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
          validate: false,
        })
        const output = result.output
        if (!Value.Check(schema, output)) {
          throw new Error(
            `callEditor: editor output validation failed at ${firstValidationFailure(schema, output)}`,
          )
        }
        return output as { patches: Record<string, string> }
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
      if (!Value.Check(schema, parsed)) {
        throw new Error(
          `callEditor: editor output validation failed at ${firstValidationFailure(schema, parsed)}`,
        )
      }
      return parsed as { patches: Record<string, string> }
    } catch (error) {
      this.logger.warn(
        `callEditor failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }
}
