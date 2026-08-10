import type { GenerationMetrics } from '~/api/ai'
import type { AiOverviewCapability, AiOverviewDetail } from '~/api/ai-overview'

export interface AssetRow {
  anchorKey: string
  capability: AiOverviewCapability
  createdAt: string
  id: string
  lang: string
  metrics?: GenerationMetrics | null
  preview: string
}

const ORDER: AiOverviewCapability[] = [
  'summary',
  'insights',
  'translation',
  'tts',
]

export function buildAssetRows(detail: AiOverviewDetail): AssetRow[] {
  const { assets } = detail
  const byCapability: Record<AiOverviewCapability, AssetRow[]> = {
    summary: assets.summary.map((row) => ({
      anchorKey: `summary:${row.lang}`,
      capability: 'summary',
      createdAt: row.createdAt,
      id: row.id,
      lang: row.lang,
      metrics: row.generationMetrics,
      preview: row.summary,
    })),
    insights: assets.insights.map((row) => ({
      anchorKey: `insights:${row.lang}`,
      capability: 'insights',
      createdAt: row.createdAt,
      id: row.id,
      lang: row.lang,
      metrics: row.generationMetrics,
      preview: firstLine(row.content),
    })),
    translation: assets.translation.map((row) => ({
      anchorKey: `translation:${row.lang}`,
      capability: 'translation',
      createdAt: row.createdAt,
      id: row.id,
      lang: row.lang,
      metrics: row.generationMetrics,
      preview: `${row.sourceLang} → ${row.lang}`,
    })),
    tts: assets.tts.map((row) => ({
      anchorKey: `tts:${row.lang}`,
      capability: 'tts',
      createdAt: row.createdAt,
      id: row.id,
      lang: row.lang,
      metrics: row.generationMetrics,
      preview: formatTtsPreview(row.charCount, row.durationMs),
    })),
  }

  return ORDER.flatMap((capability) => byCapability[capability])
}

/**
 * A language can hold several rows (TTS keeps superseded takes). Anchoring
 * targets the newest, so only the first row per key answers to a matrix click.
 */
export function firstAnchorIds(rows: AssetRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(row.anchorKey)) map.set(row.anchorKey, row.id)
  }
  return map
}

function firstLine(text: string) {
  return (
    text
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? ''
  )
}

function formatTtsPreview(charCount: number, durationMs: number | null) {
  const chars = `${charCount.toLocaleString()} chars`
  if (durationMs == null) return chars
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds} · ${chars}`
}
