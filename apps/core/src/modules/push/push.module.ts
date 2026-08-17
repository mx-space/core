import { Module } from '@nestjs/common'

import { CommentModule } from '../comment/comment.module'
import { PushController } from './push.controller'
import { PushRepository } from './push.repository'
import { PushService } from './push.service'

@Module({
  imports: [CommentModule],
  controllers: [PushController],
  providers: [PushRepository, PushService],
})
export class PushModule {}
