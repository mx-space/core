import { forwardRef, Global, Module, Provider } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
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
  imports: [ScheduleModule.forRoot(), forwardRef(() => AggregateModule)],
  providers: providers,
  exports: providers,
})
@Global()
export class HelperModule {}
