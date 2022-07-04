import { Module } from '@nestjs/common'

import { DependencyController } from './dependency.controller'

@Module({
  controllers: [DependencyController],
  providers: [],
})
export class DependencyModule {}
