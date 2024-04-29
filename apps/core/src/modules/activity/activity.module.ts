import { Module, forwardRef } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { CommentModule } from '../comment/comment.module'
import { NoteModule } from '../note/note.module'
import { PostModule } from '../post/post.module'
import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'

@Module({
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
  imports: [
    GatewayModule,
    CommentModule,

    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
  ],
})
export class ActivityModule {}
