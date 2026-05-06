import {
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'

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

  @Get(':provider/*')
  async getOne(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
  ): Promise<EnrichmentResult> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    return this.enrichmentService.getOne(provider, id)
  }

  @Get('admin/list')
  @Auth()
  async list(@Query() query: AdminListQueryDto) {
    return this.enrichmentService.list(query.page, query.size)
  }

  @Post('admin/refresh/:provider/*')
  @Auth()
  @HttpCode(200)
  async refresh(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
  ): Promise<EnrichmentResult> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    return this.enrichmentService.refresh(provider, id)
  }

  @Delete('admin/cache/:provider/*')
  @Auth()
  @HttpCode(204)
  async invalidate(
    @Param('provider') provider: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const id = decodeURIComponent((req.params as Record<string, string>)['*'])
    await this.enrichmentService.invalidate(provider, id)
  }

  @Get('admin/providers')
  @Auth()
  async providers(): Promise<ProviderMeta[]> {
    return this.enrichmentService.getProviders()
  }
}
