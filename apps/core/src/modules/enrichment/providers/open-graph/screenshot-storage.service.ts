import { Injectable, Logger } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { S3Uploader } from '~/utils/s3.util'

import { EnrichmentScreenshotRepository } from '../../enrichment-screenshot.repository'
import type { ProcessedScreenshot } from './screenshot-pipeline.service'

export interface ScreenshotStoreResult {
  url: string
  objectKey: string
  bytes: number
}

const OBJECT_KEY_PREFIX = 'enrichment-screenshots'
const EVICTION_BATCH_LIMIT = 50
const TOUCH_TTL_SECONDS = 3600

const DEFAULT_MAX_ITEMS = 500
const DEFAULT_MAX_TOTAL_BYTES = 100 * 1024 * 1024

/**
 * Owns the put / evict / delete lifecycle for browser-mode screenshot blobs.
 *
 * S3 is treated as the source of truth: a DB row is only written after a
 * successful S3 PUT, and on LRU eviction the S3 DELETE runs before the DB
 * DELETE so the bucket cannot leak rows that point at missing objects.
 *
 * **Orphan S3 objects accepted**: in {@link delete}, an S3 deleteObject
 * failure is logged and swallowed so the DB row is removed regardless.
 * The admin "purge enrichment" path must never be blocked by a flaky S3
 * round-trip, and a stale `.webp` object that no longer has a DB row is
 * harmless (no admin UI references it, LRU never visits it). If/when an
 * orphan reconciliation job is added, this is the documented entry point;
 * for now the trade-off is intentional and Task 3 ships without it.
 *
 * `EnrichmentModule` wires this service in Task 4 — this file ships the
 * standalone class only. The S3 client is constructed lazily from
 * `imageStorageOptions` and cached per-call options signature so live config
 * edits (custom domain, credentials) are picked up without a restart.
 */
@Injectable()
export class ScreenshotStorageService {
  private readonly logger = new Logger(ScreenshotStorageService.name)

  private cachedUploader: { signature: string; uploader: S3Uploader } | null =
    null

  constructor(
    private readonly repository: EnrichmentScreenshotRepository,
    private readonly configsService: ConfigsService,
    private readonly redisService: RedisService,
  ) {}

  async storeOrEvict(args: {
    enrichmentId: string
    processed: ProcessedScreenshot
  }): Promise<ScreenshotStoreResult> {
    const { enrichmentId, processed } = args
    const bytes = processed.webp.length
    const objectKey = this.objectKeyFor(enrichmentId)

    const { maxItems, maxTotalBytes } = await this.readQuotaConfig()
    const s3 = await this.getUploader()

    await this.evictUntilFits({
      newBytes: bytes,
      maxItems,
      maxTotalBytes,
      s3,
      // Exclude the row we are about to upsert so a re-capture of the same
      // enrichment never evicts itself out from under the new write.
      excludeEnrichmentId: enrichmentId,
    })

    await s3.uploadBuffer(processed.webp, objectKey, 'image/webp')

    await this.repository.upsert({
      enrichmentId,
      objectKey,
      bytes,
      width: processed.width,
      height: processed.height,
      blurhash: processed.blurhash,
      palette: processed.palette,
    })

    return {
      url: s3.getPublicUrl(objectKey),
      objectKey,
      bytes,
    }
  }

  async delete(enrichmentId: string): Promise<void> {
    const row = await this.repository.findByEnrichmentId(enrichmentId)
    if (!row) return

    // S3 errors are logged and swallowed; the DB row is removed regardless
    // so the entry never appears in admin listings. Orphan S3 objects are
    // accepted — see the class JSDoc note on reconciliation. The S3Uploader
    // already maps 404 to a success.
    try {
      const s3 = await this.getUploader()
      await s3.deleteObject(row.objectKey)
    } catch (error) {
      this.logger.warn(
        `screenshot delete: S3 deleteObject failed for ${row.objectKey}: ${(error as Error).message}`,
      )
    }

    await this.repository.deleteByEnrichmentId(enrichmentId)
  }

  async touchAccess(enrichmentId: string): Promise<void> {
    const key = getRedisKey(RedisKeys.EnrichmentScreenshotTouch, enrichmentId)
    let acquired: boolean
    try {
      const client = this.redisService.getClient()
      const result = await client.set(key, '1', 'EX', TOUCH_TTL_SECONDS, 'NX')
      acquired = result === 'OK'
    } catch (error) {
      // Best-effort. LRU may drift slightly toward marking active rows as
      // stale; recoverable on next access.
      this.logger.debug(
        `screenshot touch: Redis NX-EX failed for ${enrichmentId}: ${(error as Error).message}`,
      )
      return
    }

    if (!acquired) return

    try {
      await this.repository.touchAccess(enrichmentId)
    } catch (error) {
      this.logger.debug(
        `screenshot touch: DB update failed for ${enrichmentId}: ${(error as Error).message}`,
      )
    }
  }

  private objectKeyFor(enrichmentId: string): string {
    return `${OBJECT_KEY_PREFIX}/${enrichmentId}.webp`
  }

  /**
   * Evict oldest-by-access rows until the new write fits inside both caps.
   * If a DB delete fails inside the batch, abort and rethrow — the caller
   * MUST NOT proceed to S3 PUT, or quota would overrun.
   */
  private async evictUntilFits(args: {
    newBytes: number
    maxItems: number
    maxTotalBytes: number
    s3: S3Uploader
    excludeEnrichmentId: string
  }): Promise<void> {
    const { newBytes, maxItems, maxTotalBytes, s3, excludeEnrichmentId } = args

    // Hard guard: if a single image already exceeds the total cap, eviction
    // cannot possibly help — bail with a clear error rather than spin.
    if (newBytes > maxTotalBytes) {
      throw new Error(
        `screenshot bytes (${newBytes}) exceed maxTotalBytes (${maxTotalBytes}); refusing to store`,
      )
    }

    // The row we're about to overwrite (if any) is invariant across the
    // eviction loop — same enrichmentId, hoisted so we don't re-query it
    // every iteration. Subtract its byte count from projected usage so an
    // upsert that REPLACES an existing screenshot doesn't trigger false-
    // positive eviction.
    const existing =
      await this.repository.findByEnrichmentId(excludeEnrichmentId)
    const existingBytes = existing?.bytes ?? 0
    const addedItem = existing ? 0 : 1

    // Cap iterations defensively so a misconfigured repo cannot wedge the
    // request. Each iteration evicts at most EVICTION_BATCH_LIMIT rows and
    // rechecks quota; we stop the moment projected usage fits.
    const MAX_ITERATIONS = 20
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      const usage = await this.repository.getQuotaUsage()

      let projectedCount = usage.count + addedItem
      let projectedBytes = usage.totalBytes - existingBytes + newBytes

      if (projectedCount <= maxItems && projectedBytes <= maxTotalBytes) {
        return
      }

      const candidates =
        await this.repository.findOldestByAccess(EVICTION_BATCH_LIMIT)
      if (candidates.length === 0) {
        // Nothing to evict but still over quota — this only happens when
        // the lone existing row IS the one being replaced (handled above)
        // or maxItems/maxTotalBytes was lowered below the single new row.
        throw new Error(
          `screenshot store: cannot fit new bytes (${newBytes}) within quota (items=${projectedCount}/${maxItems}, bytes=${projectedBytes}/${maxTotalBytes}) and no rows are available to evict`,
        )
      }

      let evictedAny = false
      for (const row of candidates) {
        // Skip the row we're about to overwrite — it gets replaced by upsert
        // and must not be deleted here (otherwise we evict ourselves).
        if (row.enrichmentId === excludeEnrichmentId) continue

        // Stop as soon as projected usage fits to avoid over-evicting when
        // a single removal is already enough.
        if (projectedCount <= maxItems && projectedBytes <= maxTotalBytes) {
          break
        }

        try {
          await s3.deleteObject(row.objectKey).catch((error: unknown) => {
            // The S3Uploader already swallows 404 internally. Any other
            // failure is logged and treated as "skip this row" so a single
            // dead key cannot block the whole eviction batch.
            this.logger.warn(
              `screenshot evict: S3 deleteObject failed for ${row.objectKey}: ${(error as Error).message}; treating as deleted`,
            )
          })
        } catch (error) {
          this.logger.warn(
            `screenshot evict: unexpected S3 error for ${row.objectKey}: ${(error as Error).message}`,
          )
        }

        try {
          await this.repository.deleteByEnrichmentId(row.enrichmentId)
        } catch (error) {
          // Abort: leaving the DB row in place while the S3 object is gone
          // is acceptable (frontend tolerates 404), but proceeding to PUT
          // now would risk overshooting the quota indefinitely.
          throw new Error(
            `screenshot evict: aborted batch — DB delete failed for ${row.enrichmentId}: ${(error as Error).message}`,
            { cause: error },
          )
        }
        evictedAny = true
        projectedCount -= 1
        projectedBytes -= row.bytes
      }

      if (!evictedAny) {
        // All rows in the batch were the excluded row; we cannot make
        // progress. Surface a clear error.
        throw new Error(
          'screenshot evict: no evictable rows found in batch (all matched the excluded enrichment id)',
        )
      }

      if (projectedCount <= maxItems && projectedBytes <= maxTotalBytes) {
        return
      }
    }

    throw new Error(
      'screenshot evict: exceeded iteration cap without satisfying quota',
    )
  }

  private async readQuotaConfig(): Promise<{
    maxItems: number
    maxTotalBytes: number
  }> {
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const screenshot = config.openGraph?.screenshot
    return {
      maxItems: Number(screenshot?.maxItems ?? DEFAULT_MAX_ITEMS),
      maxTotalBytes: Number(
        screenshot?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES,
      ),
    }
  }

  /**
   * Build (or retrieve a cached) `S3Uploader` from `imageStorageOptions`.
   * Re-built whenever the config signature changes so admin edits to bucket
   * or credentials are picked up without a process restart.
   *
   * `protected` so a subclass / test can swap the uploader by overriding
   * this method without monkey-patching the full instance.
   */
  protected async getUploader(): Promise<S3Uploader> {
    const config = await this.configsService.get('imageStorageOptions')
    if (
      !config.enable ||
      !config.endpoint ||
      !config.secretId ||
      !config.secretKey ||
      !config.bucket
    ) {
      throw new Error(
        'screenshot storage: imageStorageOptions is not fully configured (need enable=true, endpoint, secretId, secretKey, bucket)',
      )
    }

    const signature = [
      config.endpoint,
      config.secretId,
      config.secretKey,
      config.bucket,
      config.region ?? 'auto',
      config.customDomain ?? '',
    ].join('|')

    if (this.cachedUploader && this.cachedUploader.signature === signature) {
      return this.cachedUploader.uploader
    }

    const uploader = new S3Uploader({
      endpoint: config.endpoint,
      accessKey: config.secretId,
      secretKey: config.secretKey,
      bucket: config.bucket,
      region: config.region || 'auto',
    })
    if (config.customDomain) {
      uploader.setCustomDomain(config.customDomain)
    }
    this.cachedUploader = { signature, uploader }
    return uploader
  }
}
