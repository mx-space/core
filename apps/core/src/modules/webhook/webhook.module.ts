import { Module } from '@nestjs/common'

import { WebhookController } from './webhook.controller'
import { WebhookRepository } from './webhook.repository'
import { WebhookService } from './webhook.service'

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, WebhookRepository],
})
export class WebhookModule {}
