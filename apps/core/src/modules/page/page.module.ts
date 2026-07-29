import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { ContentMigrationCommitService } from '../content-migration/content-migration-commit.service'
import { DraftModule } from '../draft/draft.module'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { PageController } from './page.controller'
import { PageRepository } from './page.repository'
import { PageService } from './page.service'

@Module({
  imports: [GatewayModule, DraftModule, EnrichmentModule],
  controllers: [PageController],
  providers: [PageService, PageRepository, ContentMigrationCommitService],
  exports: [PageService, PageRepository],
})
export class PageModule {}
