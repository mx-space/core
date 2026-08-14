import type { TSchema } from '@earendil-works/pi-ai'
import { Type } from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'

import { AI_PROMPTS } from '../../ai.prompts'
import type { SubAgentSpec } from '../../message-engine/tools/sub-agent'
import { invokeSubAgent } from '../../message-engine/tools/sub-agent'
import type { EngineTool } from '../../message-engine/tools/tool.types'
import type { VirtualFs } from '../../message-engine/vfs/virtual-fs'
import type { ReviewerIssue } from '../reviewer.service'
import { REVIEW_WINDOW_SIZE } from '../strategies/base-translation-strategy'
import type { TranslationUnit } from '../translation-unit.types'
import {
  flatIdsOf,
  flattenUnitTranslations,
  unitsToEntries,
  unitsToSourceMap,
} from '../translation-unit.types'

export const TRANSLATION_FILE = 'translation'

export interface TranslationToolState {
  sourceLang: string | null
  firstWriteAt: number | null
  reviewRounds: number
  reviewerMs: number
  reviewerFailed: boolean
  lastIssues: ReviewerIssue[]
  patchesApplied: Array<{ id: string; before: string; after: string }>
  patchKeysRequested: string[]
  patchKeysDropped: string[]
}

const logger = new Logger('TranslationAgentTools')

const buildWriteSchema = (textEntries: Record<string, unknown>) => {
  const translationShape: Record<string, TSchema> = {}
  for (const [key, value] of Object.entries(textEntries)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as { type?: string }).type === 'text.group' &&
      Array.isArray((value as { segments?: unknown }).segments)
    ) {
      const groupShape = Object.fromEntries(
        (value as { segments: Array<{ id: string }> }).segments.map(
          (segment) => [segment.id, Type.String()],
        ),
      )
      translationShape[key] = Type.Optional(
        Type.Object(groupShape, { additionalProperties: false }),
      )
      continue
    }
    translationShape[key] = Type.Optional(Type.String())
  }
  return Type.Object(
    {
      sourceLang: Type.String({
        description: 'Detected source language as an ISO 639-1 code',
      }),
      translations: Type.Object(translationShape, {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false },
  )
}

export function createTranslationTools(opts: {
  vfs: VirtualFs
  units: TranslationUnit[]
  targetLang: string
  styleHints?: string
  reviewer?: SubAgentSpec
  reviewWindows?: readonly string[][]
  onSegments?: (segments: Record<string, string>) => Promise<void>
  signal?: AbortSignal
}): { tools: EngineTool[]; state: TranslationToolState } {
  const {
    vfs,
    units,
    targetLang,
    styleHints,
    reviewer,
    reviewWindows,
    onSegments,
    signal,
  } = opts
  const flatIds = flatIdsOf(units)
  const sources = unitsToSourceMap(units)
  const state: TranslationToolState = {
    sourceLang: null,
    firstWriteAt: null,
    reviewRounds: 0,
    reviewerMs: 0,
    reviewerFailed: false,
    lastIssues: [],
    patchesApplied: [],
    patchKeysRequested: [],
    patchKeysDropped: [],
  }

  const writeTool: EngineTool = {
    name: 'write_translation',
    description:
      'Submit translated segments for the in-memory translation file. Send the complete map on the first call; repeat calls merge and should cover only ids reported missing.',
    parameters: buildWriteSchema(unitsToEntries(units)),
    execute: async (args) => {
      const { sourceLang, translations } = args as {
        sourceLang: string
        translations: Record<string, unknown>
      }
      if (!state.sourceLang) state.sourceLang = sourceLang
      if (state.firstWriteAt === null) state.firstWriteAt = Date.now()
      const resolved = flattenUnitTranslations(units, translations)
      vfs.write(TRANSLATION_FILE, {
        ...vfs.read(TRANSLATION_FILE),
        ...resolved,
      })
      const after = vfs.read(TRANSLATION_FILE)
      const missing = flatIds.filter((id) => after[id] === undefined)
      if (onSegments && Object.keys(resolved).length > 0) {
        await onSegments(resolved)
      }
      return {
        content: JSON.stringify({ written: Object.keys(resolved), missing }),
      }
    },
  }

  const patchTool: EngineTool = {
    name: 'patch_translation',
    description:
      'Apply targeted edits to translated segments. Each edit replaces a unique `find` substring within the segment `id`; omit `find` to replace the whole segment text.',
    parameters: Type.Object(
      {
        edits: Type.Array(
          Type.Object(
            {
              id: Type.String(),
              find: Type.Optional(Type.String({ minLength: 1 })),
              replace: Type.String(),
            },
            { additionalProperties: false },
          ),
          { minItems: 1 },
        ),
      },
      { additionalProperties: false },
    ),
    execute: async (args) => {
      const { edits } = args as {
        edits: Array<{ id: string; find?: string; replace: string }>
      }
      const applied: string[] = []
      const failed: Array<{ id: string; reason: string }> = []
      const updated: Record<string, string> = {}
      for (const edit of edits) {
        state.patchKeysRequested.push(edit.id)
        if (edit.find) {
          const result = vfs.replaceInKey(
            TRANSLATION_FILE,
            edit.id,
            edit.find,
            edit.replace,
          )
          if (result.ok) {
            state.patchesApplied.push({
              id: edit.id,
              before: result.before,
              after: result.after,
            })
            applied.push(edit.id)
            updated[edit.id] = result.after
          } else {
            state.patchKeysDropped.push(edit.id)
            failed.push({ id: edit.id, reason: result.reason })
          }
          continue
        }
        const result = vfs.applyPatch(TRANSLATION_FILE, {
          [edit.id]: edit.replace,
        })
        if (result.appliedKeys.length > 0) {
          const change = result.changes[0]
          state.patchesApplied.push({
            id: change.key,
            before: change.before,
            after: change.after,
          })
          applied.push(edit.id)
          updated[edit.id] = edit.replace
        } else {
          state.patchKeysDropped.push(edit.id)
          failed.push({ id: edit.id, reason: 'missing-key' })
        }
      }
      if (onSegments && Object.keys(updated).length > 0) {
        await onSegments(updated)
      }
      return { content: JSON.stringify({ applied, failed }) }
    },
  }

  const readTool: EngineTool = {
    name: 'read_translation',
    description: 'Read the current translation file as an id → text map.',
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => ({
      content: JSON.stringify(vfs.read(TRANSLATION_FILE)),
    }),
  }

  const tools = [writeTool, patchTool, readTool]

  if (reviewer) {
    const reviewTool: EngineTool = {
      name: 'request_review',
      description:
        'Ask an independent reviewer to inspect the current translation file. Returns a list of issues; an empty list means the translation is acceptable.',
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: async (_args, execSignal) => {
        state.reviewRounds++
        const bilingual = state.reviewRounds > 1
        const current = vfs.read(TRANSLATION_FILE)
        const ids = flatIds.filter((id) => current[id] !== undefined)
        const allowed = new Set(ids)
        const windows: string[][] = reviewWindows
          ? reviewWindows
              .map((window) => window.filter((id) => allowed.has(id)))
              .filter((window) => window.length > 0)
          : []
        if (!reviewWindows) {
          for (let i = 0; i < ids.length; i += REVIEW_WINDOW_SIZE) {
            windows.push(ids.slice(i, i + REVIEW_WINDOW_SIZE))
          }
        }
        const started = Date.now()
        const issues: ReviewerIssue[] = []
        let reviewedWindows = 0
        for (const window of windows) {
          const segments = Object.fromEntries(
            window.map((id) => [
              id,
              bilingual
                ? { source: sources[id], target: current[id] ?? '' }
                : { target: current[id] ?? '' },
            ]),
          )
          const { prompt, schema } = AI_PROMPTS.translationReviewer(
            targetLang,
            { allowedIds: window, segments, styleHints },
          )
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const output = await invokeSubAgent(reviewer, {
                prompt,
                schema,
                signal: execSignal ?? signal,
              })
              reviewedWindows++
              const allowed = new Set(window)
              issues.push(
                ...(output as { issues: ReviewerIssue[] }).issues.filter(
                  (issue) => allowed.has(issue.id),
                ),
              )
              break
            } catch (error) {
              logger.warn(
                `request_review window failed (attempt ${attempt}/2): ${
                  error instanceof Error ? error.message : String(error)
                }`,
              )
            }
          }
        }
        state.reviewerMs += Date.now() - started
        if (windows.length > 0 && reviewedWindows === 0) {
          state.reviewerFailed = true
          return {
            content: 'reviewer failed; keep current translations and finish',
            isError: true,
          }
        }
        state.lastIssues = issues
        return { content: JSON.stringify({ issues }) }
      },
    }
    tools.push(reviewTool)
  }

  return { tools, state }
}
