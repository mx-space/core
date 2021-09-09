import { forwardRef, Global, Module, Provider } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { NoteModule } from '~/modules/note/note.module'
import { PageModule } from '~/modules/page/page.module'
import { PostModule } from '~/modules/post/post.module'
import { CountingService } from './helper.counting.service'
import { CronService } from './helper.cron.service'
import { EmailService } from './helper.email.service'
import { HttpService } from './helper.http.service'
import { ImageService } from './helper.image.service'
import { UploadService } from './helper.upload.service'

const providers: Provider<any>[] = [
  EmailService,
  HttpService,
  ImageService,
  CronService,
  CountingService,
  UploadService,
]

@Module({
  imports: [
    ScheduleModule.forRoot(),

    forwardRef(() => AggregateModule),
    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
    forwardRef(() => PageModule),
  ],
  providers: providers,
  exports: providers,
})
@Global()
export class HelperModule {}
