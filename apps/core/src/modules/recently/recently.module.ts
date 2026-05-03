import { forwardRef, Module } from '@nestjs/common'

import { CommentModule } from '../comment/comment.module'
import { RecentlyController } from './recently.controller'
import { RecentlyRepository } from './recently.repository'
import { RecentlyService } from './recently.service'

@Module({
  controllers: [RecentlyController],
  providers: [RecentlyService, RecentlyRepository],
  exports: [RecentlyService, RecentlyRepository],
  imports: [forwardRef(() => CommentModule)],
})
export class RecentlyModule {}
