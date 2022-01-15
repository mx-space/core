import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { OptionController } from './option.controller'

@Module({
  imports: [GatewayModule],
  controllers: [OptionController],
})
export class OptionModule {}
