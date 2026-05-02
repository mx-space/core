import { Module } from '@nestjs/common'

import { ProjectController } from './project.controller'
import { ProjectRepository } from './project.repository'

@Module({
  controllers: [ProjectController],
  providers: [ProjectRepository],
  exports: [ProjectRepository],
})
export class ProjectModule {}
