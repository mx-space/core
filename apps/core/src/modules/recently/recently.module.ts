import { forwardRef, Module } from '@nestjs/common'
import { CommentModule } from '../comment/comment.module'
import { RecentlyController } from './recently.controller'
import { RecentlyService } from './recently.service'

@Module({
  controllers: [RecentlyController],
  providers: [RecentlyService],
  exports: [RecentlyService],
  imports: [forwardRef(() => CommentModule)],
})
export class RecentlyModule {}
