import { Module } from '@nestjs/common'
import { ProjectContoller } from './project.controller'

@Module({ controllers: [ProjectContoller] })
export class ProjectModule {}
