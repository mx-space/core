import { Module } from '@nestjs/common'

import { PluginController } from './plugin.controller'

@Module({
  controllers: [PluginController],
})
export class PluginModule {}
