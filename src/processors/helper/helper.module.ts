import { forwardRef, Global, Module, Provider } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { NoteModule } from '~/modules/note/note.module'
import { PageModule } from '~/modules/page/page.module'
import { PostModule } from '~/modules/post/post.module'
import { SearchModule } from '~/modules/search/search.module'
import { AssetService } from './helper.asset.service'
import { CountingService } from './helper.counting.service'
import { CronService } from './helper.cron.service'
import { EmailService } from './helper.email.service'
import { HttpService } from './helper.http.service'
import { ImageService } from './helper.image.service'
import { TaskQueueService } from './helper.tq.service'
import { UploadService } from './helper.upload.service'

const providers: Provider<any>[] = [
  HttpService,
  EmailService,
  ImageService,
  CronService,
  CountingService,
  UploadService,
  AssetService,
  TaskQueueService,
]

@Module({
  imports: [
    ScheduleModule.forRoot(),

    forwardRef(() => AggregateModule),
    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
    forwardRef(() => PageModule),
    forwardRef(() => SearchModule),
  ],
  providers: providers,
  exports: providers,
})
@Global()
export class HelperModule {}
