import { Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { DependencyController } from './dependency.controller'

@Module({
  controllers: [DependencyController],
  providers: [],
  imports: [ServerlessModule],
})
export class DependencyModule {}
