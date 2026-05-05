import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common'

import { Auth } from '~/common/decorators/auth.decorator'
import { ApiController } from '~/common/decorators/api-controller.decorator'

import { AdminListQueryDto, ResolveQueryDto } from './enrichment.schema'
import { EnrichmentService } from './enrichment.service'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'

@ApiController('enrichment')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Get('resolve')
  async resolve(
    @Query() query: ResolveQueryDto,
    @Res({ passthrough: true }) res: any,
  ): Promise<EnrichmentResult> {
    const { result, stale } = await this.enrichmentService.resolve(query.url)
    if (stale) {
      res.setHeader('X-Enrichment-Stale', 'true')
    }
    return result
  }

  @Get(':provider/:id(*)')
  async getOne(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ): Promise<EnrichmentResult> {
    return this.enrichmentService.getOne(provider, decodeURIComponent(id))
  }

  @Get('admin/list')
  @Auth()
  async list(@Query() query: AdminListQueryDto) {
    return this.enrichmentService.list(query.page, query.size)
  }

  @Post('admin/refresh/:provider/:id(*)')
  @Auth()
  @HttpCode(200)
  async refresh(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ): Promise<EnrichmentResult> {
    return this.enrichmentService.refresh(provider, decodeURIComponent(id))
  }

  @Delete('admin/cache/:provider/:id(*)')
  @Auth()
  @HttpCode(204)
  async invalidate(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.enrichmentService.invalidate(provider, decodeURIComponent(id))
  }

  @Get('admin/providers')
  @Auth()
  async providers(): Promise<ProviderMeta[]> {
    return this.enrichmentService.getProviders()
  }
}
