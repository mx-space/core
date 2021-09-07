import { Global, Module, Provider } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
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
  imports: [ScheduleModule.forRoot()],
  providers: providers,
  exports: providers,
})
@Global()
export class HelperModule {}
