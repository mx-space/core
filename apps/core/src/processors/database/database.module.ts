import { Global, Module } from '@nestjs/common'

import { NoteRepository } from '~/modules/note/note.repository'
import { PageRepository } from '~/modules/page/page.repository'
import { PostRepository } from '~/modules/post/post.repository'
import { RecentlyRepository } from '~/modules/recently/recently.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { DatabaseService } from './database.service'
import { postgresProviders } from './postgres.provider'

@Module({
  providers: [
    DatabaseService,
    ...postgresProviders,
    SnowflakeService,
    PostRepository,
    NoteRepository,
    PageRepository,
    RecentlyRepository,
  ],
  exports: [
    DatabaseService,
    ...postgresProviders,
    SnowflakeService,
    PostRepository,
    NoteRepository,
    PageRepository,
    RecentlyRepository,
  ],
})
@Global()
export class DatabaseModule {}
