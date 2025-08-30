import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { BaseOptionController } from './controllers/base.option.controller'
import { EmailOptionController } from './controllers/email.option.controller'

@Module({
  imports: [GatewayModule],
  controllers: [BaseOptionController, EmailOptionController],
})
export class OptionModule {}
