import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { ConfigsService } from '~/modules/configs/configs.service'

import { EnrichmentRepository } from './enrichment.repository'
import {
  AdminCaptureListQueryDto,
  AdminListQueryDto,
  AdminProbeBodyDto,
  ResolveQueryDto,
} from './enrichment.schema'
import { EnrichmentService } from './enrichment.service'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import { ProviderDisabledError, TokenMissingError } from './enrichment.types'
import { EnrichmentCaptureRepository } from './enrichment-capture.repository'
import { EnrichmentOriginGuard } from './enrichment-origin.guard'
import { CaptureStorageService } from './providers/open-graph/capture-storage.service'

const PUBLIC_RESOLVE_THROTTLE = { default: { limit: 30, ttl: 60_000 } }
const ADMIN_PROBE_THROTTLE = { default: { limit: 30, ttl: 60_000 } }

const DEFAULT_CAPTURE_MAX_ITEMS = 500
const DEFAULT_CAPTURE_MAX_TOTAL_BYTES = 100 * 1024 * 1024

@ApiController('enrichment')
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly captureStorage: CaptureStorageService,
    private readonly enrichmentRepository: EnrichmentRepository,
    private readonly captureRepository: EnrichmentCaptureRepository,
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
        res.header('X-Enrichment-Stale', 'true')
      }
      this.bumpCaptureAccess(result)
      return result as EnrichmentResult
    } catch (error) {
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
    this.bumpCaptureAccess(result)
    return result
  }

  private bumpCaptureAccess(result: EnrichmentResult | undefined): void {
    if (!result?.captureImage || !result.id) return
    this.captureStorage.touchAccess(result.id).catch(() => {
      // ignored — storage logs internally
    })
  }

  @Get('admin/list')
  @Auth()
  async list(@Query() query: AdminListQueryDto) {
    const result = await this.enrichmentService.list(query.page, query.size, {
      onlyFailed: query.onlyFailed,
      locale: query.locale,
    })
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Post('admin/refresh/:provider/*')
  @Auth()
  @HttpCode(200)
  refresh(
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
  providers(): Promise<ProviderMeta[]> {
    return this.enrichmentService.getProviders()
  }

  @Get('admin/by-id/:id')
  @Auth()
  async byId(@Param('id') id: string) {
    const row = await this.enrichmentRepository.findById(id)
    if (!row)
      throw createAppException(AppErrorCode.ENRICHMENT_NOT_FOUND, { id })
    const capture = await this.captureRepository.findByEnrichmentId(id)
    return {
      ...row,
      capture,
    }
  }

  @Get('admin/captures/quota')
  @Auth()
  async captureQuota() {
    const used = await this.captureRepository.getQuotaUsage()
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const openGraph = config?.openGraph
    const captureConfig = openGraph?.screenshot
    return {
      used,
      cap: {
        maxItems: Number(captureConfig?.maxItems ?? DEFAULT_CAPTURE_MAX_ITEMS),
        maxTotalBytes: Number(
          captureConfig?.maxTotalBytes ?? DEFAULT_CAPTURE_MAX_TOTAL_BYTES,
        ),
      },
      enabled: captureConfig?.enabled === true,
      fetchMode: openGraph?.fetchMode ?? 'fetch',
    }
  }

  @Get('admin/captures')
  @Auth()
  async listCaptures(@Query() query: AdminCaptureListQueryDto) {
    const result = await this.captureRepository.listJoined(
      query.page,
      query.size,
      query.sort,
      query.order,
    )
    const items = await Promise.all(
      result.data.map(async (row) => ({
        ...row,
        publicUrl: await this.resolvePublicUrl(row.objectKey),
      })),
    )
    return withMeta(
      items,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Delete('admin/captures/:enrichmentId')
  @Auth()
  @HttpCode(204)
  async deleteCapture(
    @Param('enrichmentId') enrichmentId: string,
  ): Promise<void> {
    await this.captureStorage.delete(enrichmentId)
    await this.enrichmentRepository.clearCapture(enrichmentId)
  }

  @Post('admin/captures/:enrichmentId/recapture')
  @Auth()
  @HttpCode(200)
  async recapture(
    @Param('enrichmentId') enrichmentId: string,
  ): Promise<EnrichmentResult['captureImage']> {
    const row = await this.enrichmentRepository.findById(enrichmentId)
    if (!row)
      throw createAppException(AppErrorCode.ENRICHMENT_NOT_FOUND, {
        id: enrichmentId,
      })

    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const openGraph = config?.openGraph
    if (openGraph?.fetchMode !== 'browser') {
      throw createAppException(AppErrorCode.ENRICHMENT_BROWSER_MODE_REQUIRED)
    }
    if (openGraph.screenshot?.enabled !== true) {
      throw createAppException(AppErrorCode.ENRICHMENT_SCREENSHOT_DISABLED)
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
    const captureImage = fresh?.normalized.captureImage
    if (!captureImage) {
      throw createAppException(AppErrorCode.ENRICHMENT_CAPTURE_FAILED)
    }
    return captureImage
  }

  @Post('admin/probe')
  @Auth()
  @Throttle(ADMIN_PROBE_THROTTLE)
  @HttpCode(200)
  async probe(@Body() body: AdminProbeBodyDto) {
    const data = await this.enrichmentService.probe(
      body.url,
      body.useCache === true,
    )
    return data
  }

  private async resolvePublicUrl(objectKey: string): Promise<string> {
    try {
      return await this.captureStorage.getPublicUrlFor(objectKey)
    } catch {
      return ''
    }
  }
}
