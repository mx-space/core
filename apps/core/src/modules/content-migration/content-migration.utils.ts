import { createHash } from 'node:crypto'

import {
  analyzeMxMarkdown,
  type MarkdownConversionIssue,
  type MarkdownConversionResult,
  type MarkdownSourceRange,
  MX_MARKDOWN_CONVERTER_VERSION,
  type SerializedMxEditorState,
} from '@mx-space/editor'

import type { AiTranslationRow } from '~/modules/ai/ai-translation/ai-translation.types'
import type { DraftRefType } from '~/modules/draft/draft.enum'

import type {
  ExistingLexicalConversionResult,
  MigrationIssue,
  MigrationMemberConversionResult,
} from './content-migration.types'

export function wholeSourceRange(source: string): MarkdownSourceRange {
  const lines = source.split('\n')
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: {
      line: lines.length,
      column: lines.at(-1)!.length + 1,
      offset: source.length,
    },
  }
}

export function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function stableBlockIdFactory(input: {
  refType: DraftRefType
  refId: string
  sourceHash: string
}): (path: string) => string {
  return (path) =>
    createHash('sha256')
      .update(`${input.refType}:${input.refId}:${input.sourceHash}:${path}`)
      .digest('hex')
      .slice(0, 20)
}

export function analyzeMigrationMarkdown(
  sourceText: string,
  input: { refType: DraftRefType; refId: string },
  baselineSourceHash?: string,
): MarkdownConversionResult {
  const initial = analyzeMxMarkdown(sourceText, { profile: 'yohaku-v1' })
  if (initial.status === 'blocked') return initial
  return analyzeMxMarkdown(sourceText, {
    profile: 'yohaku-v1',
    blockIdFactory: stableBlockIdFactory({
      ...input,
      sourceHash: baselineSourceHash ?? initial.sourceHash,
    }),
  })
}

export function existingLexicalResult(
  translation: Pick<AiTranslationRow, 'content' | 'text'>,
): ExistingLexicalConversionResult | null {
  if (!translation.content) return null
  try {
    const content = JSON.parse(translation.content) as SerializedMxEditorState
    if (!content?.root || !Array.isArray(content.root.children)) return null
    return {
      status: 'already-lexical',
      profile: 'yohaku-v1',
      sourceHash: sha256(translation.content),
      content,
    }
  } catch {
    return null
  }
}

export function invalidExistingLexicalResult(
  translation: Pick<AiTranslationRow, 'content' | 'text'>,
): MarkdownConversionResult {
  const issue: MarkdownConversionIssue = {
    code: 'invalid-existing-lexical',
    feature: 'lexical-content',
    message: 'The existing Lexical translation content is invalid.',
    range: wholeSourceRange(translation.text),
    severity: 'blocking',
  }
  return {
    status: 'blocked',
    converterVersion: MX_MARKDOWN_CONVERTER_VERSION,
    profile: 'yohaku-v1',
    sourceHash: sha256(translation.content ?? ''),
    features: [],
    issues: [issue],
  }
}

export function memberIssues(
  result: MarkdownConversionResult,
  member: MigrationIssue['member'],
  memberId: string,
  lang?: string,
): MigrationIssue[] {
  if (result.status !== 'blocked') return []
  return result.issues.map((issue) => ({
    ...issue,
    member,
    memberId,
    ...(lang ? { lang } : {}),
  }))
}

function rootChildrenOf(result: MigrationMemberConversionResult): unknown[] {
  if (result.status === 'blocked') return []
  return result.content.root.children as unknown[]
}

const TRANSLATABLE_STRUCTURE_KEYS = new Set([
  '$',
  'altText',
  'caption',
  'detail',
  'direction',
  'displayName',
  'format',
  'indent',
  'mode',
  'style',
  'summary',
  'text',
  'textFormat',
  'textStyle',
  'title',
  'value',
  'version',
])

function structuralValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !TRANSLATABLE_STRUCTURE_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, structuralValue(child)]),
  )
}

export function rootBlockSignatures(
  result: MigrationMemberConversionResult,
): string[] {
  return rootChildrenOf(result).map((node) =>
    JSON.stringify(structuralValue(node)),
  )
}

export function alignmentFor(
  source: MigrationMemberConversionResult,
  translation: MigrationMemberConversionResult,
): {
  sourceBlockCount: number
  translationBlockCount: number
  alignedBlockCount: number
} {
  const sourceSignatures = rootBlockSignatures(source)
  const translationSignatures = rootBlockSignatures(translation)
  const alignedBlockCount = sourceSignatures.reduce(
    (count, signature, index) =>
      signature === translationSignatures[index] ? count + 1 : count,
    0,
  )
  return {
    sourceBlockCount: sourceSignatures.length,
    translationBlockCount: translationSignatures.length,
    alignedBlockCount,
  }
}

export function isFullyAligned(alignment: ReturnType<typeof alignmentFor>) {
  return (
    alignment.sourceBlockCount === alignment.translationBlockCount &&
    alignment.alignedBlockCount === alignment.sourceBlockCount
  )
}

export function alignRootBlockIds(
  source: SerializedMxEditorState,
  translation: SerializedMxEditorState,
): SerializedMxEditorState {
  const aligned = structuredClone(translation)
  const sourceChildren = source.root.children as Array<Record<string, unknown>>
  const translationChildren = aligned.root.children as Array<
    Record<string, unknown>
  >

  translationChildren.forEach((block, index) => {
    const sourceState = sourceChildren[index]?.$ as
      Record<string, unknown> | undefined
    const blockId = sourceState?.blockId
    if (typeof blockId !== 'string' || !blockId) return
    const state =
      block.$ && typeof block.$ === 'object' && !Array.isArray(block.$)
        ? (block.$ as Record<string, unknown>)
        : {}
    block.$ = { ...state, blockId }
  })

  return aligned
}
