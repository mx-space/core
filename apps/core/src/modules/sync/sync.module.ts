import { Module } from '@nestjs/common'
import { CategoryModule } from '../category/category.module'
import { NoteModule } from '../note/note.module'
import { PageModule } from '../page/page.module'
import { PostModule } from '../post/post.module'
import { TopicModule } from '../topic/topic.module'
import { SyncController } from './sync.controller'
import { SyncService } from './sync.service'

@Module({
  controllers: [SyncController],
  providers: [SyncService],
  imports: [PostModule, NoteModule, PageModule, CategoryModule, TopicModule],
})
export class SyncModule {}
