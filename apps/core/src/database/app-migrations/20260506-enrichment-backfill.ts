import { eq, isNull } from 'drizzle-orm'

import { recentlies } from '~/database/schema'
import { matchUrlToRef } from '~/modules/enrichment/url-match.util'

import type { AppMigration } from './types'

const URL_REGEX = /https?:\/\/\S+/i
// Strip trailing punctuation that the regex greedily includes; the CJK set
// matches the same trim used by the Yohaku post-box auto-detect.
const URL_TAIL_TRIM = /[!"'),.:;>?\]`}—…、。〉《》「」『』〕！），：；？]+$/

export function extractFirstUrl(
  content: string | null | undefined,
): string | null {
  if (!content) return null
  const m = content.match(URL_REGEX)
  if (!m) return null
  let url = m[0]
  while (URL_TAIL_TRIM.test(url)) url = url.replace(URL_TAIL_TRIM, '')
  return url || null
}

/**
 * Backfill enrichment refs on legacy `recentlies` rows that pre-date the
 * enrichment columns. Pure DB migration — DI-free, no Nest service used.
 *
 * Behavior change vs. the original Nest-DI version: previously we eagerly
 * called `EnrichmentService.resolve(url)` after writing the columns to warm
 * the cache. That step did network IO and pulled in AiModule + ConfigsModule
 * + ProviderRegistry, all of which we want OUT of the release-phase migrate
 * binary. The live server resolves these refs lazily on first read via the
 * SWR layer (see EnrichmentService default-ttl handling for `open-graph` and
 * `mx-space`), so the user-visible end state is the same — just one extra
 * background fetch on first access instead of pre-warming.
 */
export const migration: AppMigration = {
  id: '20260506-enrichment-backfill',
  description: 'Backfill enrichment refs for legacy recently rows',
  async up({ db, logger }) {
    const rows = await db
      .select({
        id: recentlies.id,
        content: recentlies.content,
        metadata: recentlies.metadata,
      })
      .from(recentlies)
      .where(isNull(recentlies.enrichmentExternalId))

    let matched = 0
    let skipped = 0
    for (const row of rows) {
      const url =
        (row.metadata as { url?: string } | null)?.url ??
        extractFirstUrl(row.content)
      if (!url) {
        skipped++
        continue
      }
      const ref = matchUrlToRef(url)
      if (!ref) {
        skipped++
        continue
      }
      await db
        .update(recentlies)
        .set({
          enrichmentProvider: ref.provider,
          enrichmentExternalId: ref.externalId,
          modifiedAt: new Date(),
        })
        .where(eq(recentlies.id, row.id))
      matched++
    }
    logger.log(
      `backfill: total=${rows.length} matched=${matched} skipped=${skipped}`,
    )
  },
}
