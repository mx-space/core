import { Module } from '@nestjs/common'

import { RenderEjsController } from './render.controller'

@Module({
  controllers: [RenderEjsController],
})
export class RenderEjsModule {}
