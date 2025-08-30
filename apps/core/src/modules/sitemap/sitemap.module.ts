import { Module } from '@nestjs/common'
import { AggregateModule } from '../aggregate/aggregate.module'
import { SitemapController } from './sitemap.controller'

@Module({ controllers: [SitemapController], imports: [AggregateModule] })
export class SitemapModule {}
