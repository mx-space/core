import {
  Body,
  ConflictException,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { ConfigsService } from '~/modules/configs/configs.service'

import { EnrichmentRepository } from './enrichment.repository'
import {
  AdminListQueryDto,
  AdminProbeBodyDto,
  AdminScreenshotListQueryDto,
  ResolveQueryDto,
} from './enrichment.schema'
import { EnrichmentService } from './enrichment.service'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import { ProviderDisabledError, TokenMissingError } from './enrichment.types'
import { EnrichmentOriginGuard } from './enrichment-origin.guard'
import { EnrichmentScreenshotRepository } from './enrichment-screenshot.repository'
import { ScreenshotStorageService } from './providers/open-graph/screenshot-storage.service'

const PUBLIC_RESOLVE_THROTTLE = { default: { limit: 30, ttl: 60_000 } }
const ADMIN_PROBE_THROTTLE = { default: { limit: 30, ttl: 60_000 } }

const DEFAULT_SCREENSHOT_MAX_ITEMS = 500
const DEFAULT_SCREENSHOT_MAX_TOTAL_BYTES = 100 * 1024 * 1024

@ApiController('enrichment')
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly screenshotStorage: ScreenshotStorageService,
    private readonly enrichmentRepository: EnrichmentRepository,
    private readonly screenshotRepository: EnrichmentScreenshotRepository,
    private readonly configsService: ConfigsService,
  ) {}

  @Get('resolve')
  @Throttle(PUBLIC_RESOLVE_THROTTLE)
  @UseGuards(EnrichmentOriginGuard)
  async resolve(
    @Query() query: ResolveQueryDto,
    @Lang() lang: string | undefined,
    @Res({ passthrough: true }) res: any,
  ): Promise<EnrichmentResult | undefined> {
    try {
      const { result, stale } = await this.enrichmentService.resolve(
        query.url,
        lang,
      )
      if (stale) {
        // Fastify reply uses `header(name, value)`; the legacy
        // `setHeader` shim is not exposed when accessed through Nest's
        // `@Res({ passthrough: true })` adapter object.
        res.header('X-Enrichment-Stale', 'true')
      }
      this.bumpScreenshotAccess(result)
      return result
    } catch (error) {
      // Provider not configured / token missing is a "no data" case, not an
      // error: return 204 so frontends can render the URL as a plain link
      // without per-card 500s polluting logs.
      if (
        error instanceof ProviderDisabledError ||
        error instanceof TokenMissingError
      ) {
        res.status(204)
        return
      }
      throw error
    }
  }

  @Get(':provider/*')
  @Throttle(PUBLIC_RESOLVE_THROTTLE)
  @UseGuards(EnrichmentOriginGuard)
  async getOne(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
    @Lang() lang: string | undefined,
  ): Promise<EnrichmentResult> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    const result = await this.enrichmentService.getOne(provider, id, lang)
    this.bumpScreenshotAccess(result)
    return result
  }

  /**
   * Fire-and-forget LRU touch. The throttle (Redis NX-EX 3600s) lives inside
   * the storage service, so hot URLs do not write per-request. Failure is
   * swallowed to keep the hot path free of screenshot-storage faults.
   */
  private bumpScreenshotAccess(result: EnrichmentResult | undefined): void {
    if (!result?.screenshot || !result.id) return
    this.screenshotStorage.touchAccess(result.id).catch(() => {
      // ignored — storage logs internally
    })
  }

  @Get('admin/list')
  @Auth()
  async list(@Query() query: AdminListQueryDto) {
    return this.enrichmentService.list(query.page, query.size, {
      onlyFailed: query.onlyFailed,
      locale: query.locale,
    })
  }

  @Post('admin/refresh/:provider/*')
  @Auth()
  @HttpCode(200)
  async refresh(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
    @Query('lang') lang?: string,
  ): Promise<EnrichmentResult> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    return this.enrichmentService.refresh(provider, id, lang)
  }

  @Delete('admin/cache/:provider/*')
  @Auth()
  @HttpCode(204)
  async invalidate(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
    @Query('lang') lang?: string,
  ): Promise<void> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    await this.enrichmentService.invalidate(provider, id, lang)
  }

  @Get('admin/providers')
  @Auth()
  async providers(): Promise<ProviderMeta[]> {
    return this.enrichmentService.getProviders()
  }

  @Get('admin/by-id/:id')
  @Auth()
  async byId(@Param('id') id: string) {
    const row = await this.enrichmentRepository.findById(id)
    if (!row) throw new NotFoundException(`Enrichment ${id} not found`)
    const screenshot = await this.screenshotRepository.findByEnrichmentId(id)
    return { ...row, screenshot }
  }

  @Get('admin/screenshots/quota')
  @Auth()
  async screenshotQuota() {
    const used = await this.screenshotRepository.getQuotaUsage()
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const openGraph = config?.openGraph
    const screenshot = openGraph?.screenshot
    return {
      used,
      cap: {
        maxItems: Number(screenshot?.maxItems ?? DEFAULT_SCREENSHOT_MAX_ITEMS),
        maxTotalBytes: Number(
          screenshot?.maxTotalBytes ?? DEFAULT_SCREENSHOT_MAX_TOTAL_BYTES,
        ),
      },
      enabled: screenshot?.enabled === true,
      fetchMode: openGraph?.fetchMode ?? 'fetch',
    }
  }

  @Get('admin/screenshots')
  @Auth()
  async listScreenshots(@Query() query: AdminScreenshotListQueryDto) {
    const result = await this.screenshotRepository.listJoined(
      query.page,
      query.size,
      query.sort,
      query.order,
    )
    const data = await Promise.all(
      result.data.map(async (row) => ({
        ...row,
        publicUrl: await this.resolvePublicUrl(row.objectKey),
      })),
    )
    return { data, pagination: result.pagination }
  }

  @Delete('admin/screenshots/:enrichmentId')
  @Auth()
  @HttpCode(204)
  async deleteScreenshot(
    @Param('enrichmentId') enrichmentId: string,
  ): Promise<void> {
    await this.screenshotStorage.delete(enrichmentId)
    await this.enrichmentRepository.clearScreenshot(enrichmentId)
  }

  @Post('admin/screenshots/:enrichmentId/recapture')
  @Auth()
  @HttpCode(200)
  async recaptureScreenshot(
    @Param('enrichmentId') enrichmentId: string,
  ): Promise<EnrichmentResult['screenshot']> {
    const row = await this.enrichmentRepository.findById(enrichmentId)
    if (!row)
      throw new NotFoundException(`Enrichment ${enrichmentId} not found`)

    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const openGraph = config?.openGraph
    if (openGraph?.fetchMode !== 'browser') {
      throw new ConflictException({
        code: 'browser_mode_required',
        message: 'OpenGraph fetchMode must be `browser` to recapture',
      })
    }
    if (openGraph.screenshot?.enabled !== true) {
      throw new ConflictException({
        code: 'screenshot_disabled',
        message: 'openGraph.screenshot.enabled is false',
      })
    }

    await this.enrichmentService.refresh(
      row.provider,
      row.externalId,
      row.locale,
      {
        url: row.url,
      },
    )

    const fresh = await this.enrichmentRepository.findById(enrichmentId)
    const screenshot = fresh?.normalized.screenshot
    if (!screenshot) {
      throw new UnprocessableEntityException({
        code: 'capture_failed',
        message: 'Screenshot was not produced by the refresh',
      })
    }
    return screenshot
  }

  @Post('admin/probe')
  @Auth()
  @Throttle(ADMIN_PROBE_THROTTLE)
  @HttpCode(200)
  async probe(@Body() body: AdminProbeBodyDto) {
    return this.enrichmentService.probe(body.url, body.useCache === true)
  }

  private async resolvePublicUrl(objectKey: string): Promise<string> {
    try {
      return await this.screenshotStorage.getPublicUrlFor(objectKey)
    } catch {
      return ''
    }
  }
}
