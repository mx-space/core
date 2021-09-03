import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { OptionController } from './option.controller'
import { OptionService } from './option.service'

@Module({
  imports: [GatewayModule],
  controllers: [OptionController],
  providers: [OptionService],
})
export class OptionModule {}
