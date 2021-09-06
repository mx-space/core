import { Global, Module, Provider } from '@nestjs/common'
import { CountingService } from './helper.counting.service'
import { EmailService } from './helper.email.service'
import { HttpService } from './helper.http.service'
import { ImageService } from './helper.image.service'

const providers: Provider<any>[] = [
  EmailService,
  HttpService,
  ImageService,
  CountingService,
]

@Module({ imports: [], providers: providers, exports: providers })
@Global()
export class HelperModule {}
