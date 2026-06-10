import {
  type LexicalTranslationResult,
  parseLexicalForTranslation,
  type PropertySegment,
  type TranslationSegment,
} from './lexical-translation-parser'
import { validateMermaidTranslation } from './mermaid-translation-guard'

export interface BlockTranslationSegments {
  segments: TranslationSegment[]
  propertySegments: PropertySegment[]
}

export interface BackfillReusableBlockResult {
  reusedBlockIds: string[]
  skippedBlockIds: string[]
}

export function groupSegmentsByBlock(
  result: LexicalTranslationResult,
): Map<string, BlockTranslationSegments> {
  const byBlock = new Map<string, BlockTranslationSegments>()

  const getBucket = (blockId: string) => {
    let bucket = byBlock.get(blockId)
    if (!bucket) {
      bucket = { segments: [], propertySegments: [] }
      byBlock.set(blockId, bucket)
    }
    return bucket
  }

  for (const segment of result.segments) {
    if (!segment.blockId || !segment.translatable) continue
    getBucket(segment.blockId).segments.push(segment)
  }

  for (const propertySegment of result.propertySegments) {
    if (!propertySegment.blockId) continue
    getBucket(propertySegment.blockId).propertySegments.push(propertySegment)
  }

  return byBlock
}

export function canReuseBlockTranslations(
  currentBlock: BlockTranslationSegments,
  translatedBlock: BlockTranslationSegments,
): boolean {
  if (currentBlock.segments.length !== translatedBlock.segments.length) {
    return false
  }

  if (
    currentBlock.propertySegments.length !==
    translatedBlock.propertySegments.length
  ) {
    return false
  }

  const propertyShapeMatches = currentBlock.propertySegments.every(
    (segment, index) => {
      const translatedSegment = translatedBlock.propertySegments[index]
      return (
        translatedSegment.property === segment.property &&
        translatedSegment.key === segment.key
      )
    },
  )
  if (!propertyShapeMatches) {
    return false
  }

  // A stored "translation" byte-identical to the current source means the
  // block was never actually translated (writer echo or fallback-to-original).
  // Reusing it would freeze the untranslated text across every future
  // incremental run, so force a retranslation instead.
  const hasAnySegment =
    currentBlock.segments.length > 0 || currentBlock.propertySegments.length > 0
  const identicalToSource =
    hasAnySegment &&
    currentBlock.segments.every(
      (segment, index) => translatedBlock.segments[index].text === segment.text,
    ) &&
    currentBlock.propertySegments.every(
      (segment, index) =>
        translatedBlock.propertySegments[index].text === segment.text,
    )

  return !identicalToSource
}

export function backfillReusableBlockTranslations(
  currentResult: LexicalTranslationResult,
  translatedResult: LexicalTranslationResult,
  unchangedBlockIds: Set<string>,
  output: Map<string, string>,
): BackfillReusableBlockResult {
  const currentBlocks = groupSegmentsByBlock(currentResult)
  const translatedBlocks = groupSegmentsByBlock(translatedResult)
  const reusedBlockIds: string[] = []
  const skippedBlockIds: string[] = []

  for (const blockId of unchangedBlockIds) {
    const currentBlock = currentBlocks.get(blockId)
    const translatedBlock = translatedBlocks.get(blockId)

    if (
      !currentBlock ||
      !translatedBlock ||
      !canReuseBlockTranslations(currentBlock, translatedBlock)
    ) {
      skippedBlockIds.push(blockId)
      continue
    }

    currentBlock.segments.forEach((segment, index) => {
      output.set(segment.id, translatedBlock.segments[index].text)
    })

    currentBlock.propertySegments.forEach((propertySegment, index) => {
      output.set(
        propertySegment.id,
        translatedBlock.propertySegments[index].text,
      )
    })

    reusedBlockIds.push(blockId)
  }

  return { reusedBlockIds, skippedBlockIds }
}

export interface TranslationOverlay {
  parseResult: LexicalTranslationResult
  translations: Map<string, string>
  unchangedBlockIds: Set<string>
  backfill: BackfillReusableBlockResult
}

// Shared zero-LLM prefix of incremental translation: diff current root-block
// fingerprints against the stored snapshots, parse both documents, and
// backfill translations for unchanged blocks. Consumed by both the
// incremental strategy (which then sends the rest to the writer) and the
// read-path partial overlay builder (which restores with the backfill only).
export function buildReusableTranslationOverlay(
  currentContent: string,
  translatedContent: string,
  currentBlocks: ReadonlyArray<{ id: string | null; fingerprint: string }>,
  oldSnapshots: ReadonlyArray<{ id: string; fingerprint: string }>,
): TranslationOverlay {
  const oldFingerprintByBlockId = new Map(
    oldSnapshots.map((snapshot) => [snapshot.id, snapshot.fingerprint]),
  )
  const unchangedBlockIds = new Set<string>()
  for (const block of currentBlocks) {
    if (
      block.id &&
      oldFingerprintByBlockId.get(block.id) === block.fingerprint
    ) {
      unchangedBlockIds.add(block.id)
    }
  }

  const parseResult = parseLexicalForTranslation(currentContent)
  const translatedParseResult = parseLexicalForTranslation(translatedContent)
  const translations = new Map<string, string>()
  const backfill = backfillReusableBlockTranslations(
    parseResult,
    translatedParseResult,
    unchangedBlockIds,
    translations,
  )

  return { parseResult, translations, unchangedBlockIds, backfill }
}

export function guardMermaidTranslations(
  parseResult: LexicalTranslationResult,
  translations: Map<string, string>,
  onReject?: (message: string) => void,
): void {
  for (const prop of parseResult.propertySegments) {
    if (prop.property !== 'diagram' || prop.node?.type !== 'mermaid') continue
    const translated = translations.get(prop.id)
    if (translated === undefined) continue
    if (translated === prop.text) continue

    const validation = validateMermaidTranslation(prop.text, translated)
    if (!validation.ok) {
      const message = `Mermaid translation rejected: reason=${validation.reason} sourceLen=${prop.text.length} translatedLen=${translated.length}`
      onReject?.(message)
      translations.delete(prop.id)
    }
  }
}
