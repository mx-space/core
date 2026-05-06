import { EnrichmentService } from '~/modules/enrichment/enrichment.service'
import { RecentlyRepository } from '~/modules/recently/recently.repository'

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

export const migration: AppMigration = {
  id: '20260506-enrichment-backfill',
  description: 'Backfill enrichment refs for legacy recently rows',
  async up({ app, logger }) {
    const enrichmentService = app.get(EnrichmentService)
    const recentlyRepo = app.get(RecentlyRepository)

    const rows = await recentlyRepo.findWithoutEnrichment()
    let matched = 0
    let skipped = 0
    let resolveFailed = 0
    for (const row of rows) {
      const url =
        (row.metadata as { url?: string } | null)?.url ??
        extractFirstUrl(row.content)
      if (!url) {
        skipped++
        continue
      }
      const ref = enrichmentService.matchUrlToRef(url)
      if (!ref) {
        skipped++
        continue
      }
      await recentlyRepo.update(row.id, {
        enrichmentProvider: ref.provider,
        enrichmentExternalId: ref.externalId,
      })
      try {
        await enrichmentService.resolve(url)
      } catch (err) {
        resolveFailed++
        logger.warn(`resolve failed for ${url}: ${(err as Error).message}`)
      }
      matched++
    }
    logger.log(
      `backfill: total=${rows.length} matched=${matched} skipped=${skipped} resolveFailed=${resolveFailed}`,
    )
  },
}
