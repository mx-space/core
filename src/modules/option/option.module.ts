import { Module } from '@nestjs/common'
import { BaseOptionController } from './controllers/base.option.controller'
import { EmailOptionController } from './controllers/email.option.controller'
import { GatewayModule } from '~/processors/gateway/gateway.module'

@Module({
  imports: [GatewayModule],
  controllers: [BaseOptionController, EmailOptionController],
})
export class OptionModule {}
