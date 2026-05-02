import { Global, Module } from '@nestjs/common'

import { NoteModule } from '~/modules/note/note.module'
import { PageModule } from '~/modules/page/page.module'
import { PostModule } from '~/modules/post/post.module'
import { RecentlyModule } from '~/modules/recently/recently.module'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { DatabaseService } from './database.service'
import { postgresProviders } from './postgres.provider'

@Module({
  imports: [PostModule, NoteModule, PageModule, RecentlyModule],
  providers: [DatabaseService, ...postgresProviders, SnowflakeService],
  exports: [DatabaseService, ...postgresProviders, SnowflakeService],
})
@Global()
export class DatabaseModule {}
