import type { Provider } from '@nestjs/common'
import { forwardRef, Global, Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { THROTTLE_OPTIONS } from '~/app.config'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { NoteModule } from '~/modules/note/note.module'
import { PageModule } from '~/modules/page/page.module'
import { PostModule } from '~/modules/post/post.module'
import { AssetService } from './helper.asset.service'
import { BarkPushService } from './helper.bark.service'
import { CountingService } from './helper.counting.service'
import { CronService } from './helper.cron.service'
import { EmailService } from './helper.email.service'
import { EventManagerService } from './helper.event.service'
import { HttpService } from './helper.http.service'
import { ImageService } from './helper.image.service'
import { JWTService } from './helper.jwt.service'
import { TextMacroService } from './helper.macro.service'
import { TaskQueueService } from './helper.tq.service'
import { UploadService } from './helper.upload.service'
import { UrlBuilderService } from './helper.url-builder.service'

const providers: Provider<any>[] = [
  AssetService,
  BarkPushService,
  CountingService,
  CronService,
  EmailService,
  EventManagerService,
  HttpService,
  JWTService,
  ImageService,
  UrlBuilderService,
  TaskQueueService,
  TextMacroService,
  UploadService,
]

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([THROTTLE_OPTIONS]),
    EventEmitterModule.forRoot({
      wildcard: false,
      // the delimiter used to segment namespaces
      delimiter: '.',
      // set this to `true` if you want to emit the newListener event
      newListener: false,
      // set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // the maximum amount of listeners that can be assigned to an event
      maxListeners: 20,
      // show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: isDev,
      // disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),

    forwardRef(() => AggregateModule),
    forwardRef(() => PostModule),
    forwardRef(() => NoteModule),
    forwardRef(() => PageModule),
  ],
  providers,
  exports: providers,
})
@Global()
export class HelperModule {}
