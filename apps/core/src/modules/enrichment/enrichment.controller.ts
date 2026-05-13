import {
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

import { AdminListQueryDto, ResolveQueryDto } from './enrichment.schema'
import { EnrichmentService } from './enrichment.service'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import { ProviderDisabledError, TokenMissingError } from './enrichment.types'
import { EnrichmentOriginGuard } from './enrichment-origin.guard'
import { ScreenshotStorageService } from './providers/open-graph/screenshot-storage.service'

const PUBLIC_RESOLVE_THROTTLE = { default: { limit: 30, ttl: 60_000 } }

@ApiController('enrichment')
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly screenshotStorage: ScreenshotStorageService,
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
}
