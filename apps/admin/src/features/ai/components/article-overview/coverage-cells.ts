import type {
  ActiveGeneration,
  AiOverviewCapability,
  ArticleCoverage,
} from '~/api/ai-overview'
import { AI_OVERVIEW_CAPABILITIES } from '~/api/ai-overview'

export type CellState = 'addable' | 'gap' | 'has' | 'na' | 'pending' | 'source'

/**
 * A queued task with no languages covers the whole capability — the server
 * could not name them because the request left the target list to config.
 */
export function isGenerationPending(
  activeTasks: ActiveGeneration[],
  capability: AiOverviewCapability,
  lang: string,
): boolean {
  return activeTasks.some(
    (task) =>
      task.capability === capability &&
      (task.langs.length === 0 || task.langs.includes(lang)),
  )
}

export function coverageColumns(
  coverage: ArticleCoverage,
  extra: string[] = [],
): string[] {
  const langs = new Set<string>()
  for (const capability of AI_OVERVIEW_CAPABILITIES) {
    for (const lang of coverage[capability].langs) langs.add(lang)
    for (const lang of coverage[capability].expected) langs.add(lang)
  }
  if (coverage.sourceLang) langs.add(coverage.sourceLang)
  for (const lang of extra) langs.add(lang)
  return [...langs].sort()
}

/** ISO 639-1/639-2 shape only — the server is the real authority. */
export function normaliseLangInput(raw: string): string | null {
  const value = raw.trim().split('-')[0].toLowerCase()
  return /^[a-z]{2,3}$/.test(value) ? value : null
}

export function resolveCell(
  coverage: ArticleCoverage,
  capability: AiOverviewCapability,
  lang: string,
  activeTasks: ActiveGeneration[] = [],
): CellState {
  if (capability === 'translation' && lang === coverage.sourceLang) {
    return 'source'
  }
  const cell = coverage[capability]
  if (!cell.applicable) return 'na'
  if (cell.langs.includes(lang)) return 'has'
  // A running task outranks the gap glyph: leaving the `+` up invites a second
  // click that queues the same work twice.
  if (isGenerationPending(activeTasks, capability, lang)) return 'pending'
  // `expected` only says which languages the config asks for; anything the
  // capability supports can still be generated on demand, so an unexpected
  // language stays clickable rather than dimming into "not applicable".
  if (cell.expected.includes(lang)) return 'gap'
  return 'addable'
}

export function isCellActionable(state: CellState): boolean {
  return state === 'has' || state === 'gap' || state === 'addable'
}

export function capabilityDotState(
  coverage: ArticleCoverage,
  capability: AiOverviewCapability,
): 'full' | 'none' | 'partial' {
  const cell = coverage[capability]
  if (!cell.applicable || !cell.expected.length) {
    return cell.langs.length ? 'full' : 'none'
  }
  const have = new Set(cell.langs)
  const covered = cell.expected.filter((lang) => have.has(lang)).length
  if (covered === 0) return 'none'
  return covered === cell.expected.length ? 'full' : 'partial'
}
