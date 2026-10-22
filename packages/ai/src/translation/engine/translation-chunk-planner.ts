import type { TranslationUnit } from '../translation-unit.types'
import { flatIdsOf } from '../translation-unit.types'

export const DIRECT_TRANSLATION_MAX_SOURCE_CHARS = 12_000
export const DIRECT_TRANSLATION_MAX_SEGMENTS = 240
export const TRANSLATION_CHUNK_MAX_SOURCE_CHARS = 6_000
export const TRANSLATION_CHUNK_MAX_SEGMENTS = 120

export interface TranslationChunk {
  id: string
  units: TranslationUnit[]
  sourceChars: number
  segmentCount: number
}

export interface TranslationLoad {
  sourceChars: number
  segmentCount: number
}

export const translationUnitSourceChars = (unit: TranslationUnit): number => {
  if (typeof unit.payload === 'string') return unit.payload.length
  return unit.payload.segments.reduce(
    (total, segment) => total + segment.text.length,
    0,
  )
}

export const estimateTranslationLoad = (
  units: readonly TranslationUnit[],
): TranslationLoad => ({
  sourceChars: units.reduce(
    (total, unit) => total + translationUnitSourceChars(unit),
    0,
  ),
  segmentCount: flatIdsOf([...units]).length,
})

export const shouldUseChunkedTranslation = (
  units: readonly TranslationUnit[],
): boolean => {
  const load = estimateTranslationLoad(units)
  return (
    load.sourceChars > DIRECT_TRANSLATION_MAX_SOURCE_CHARS ||
    load.segmentCount > DIRECT_TRANSLATION_MAX_SEGMENTS
  )
}

export const planTranslationChunks = (
  units: readonly TranslationUnit[],
): TranslationChunk[] => {
  const chunks: TranslationChunk[] = []
  let pending: TranslationUnit[] = []
  let sourceChars = 0
  let segmentCount = 0

  const flush = () => {
    if (pending.length === 0) return
    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      units: pending,
      sourceChars,
      segmentCount,
    })
    pending = []
    sourceChars = 0
    segmentCount = 0
  }

  for (const unit of units) {
    const unitSourceChars = translationUnitSourceChars(unit)
    const unitSegmentCount = unit.memberIds?.length ?? 1
    const exceedsBudget =
      pending.length > 0 &&
      (sourceChars + unitSourceChars > TRANSLATION_CHUNK_MAX_SOURCE_CHARS ||
        segmentCount + unitSegmentCount > TRANSLATION_CHUNK_MAX_SEGMENTS)
    if (exceedsBudget) flush()
    pending.push(unit)
    sourceChars += unitSourceChars
    segmentCount += unitSegmentCount
  }
  flush()
  return chunks
}
