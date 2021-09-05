import { Global, Module, Provider } from '@nestjs/common'
import { EmailService } from './helper.email.service'
import { HttpService } from './helper.http.service'
import { ImageService } from './helper.image.service'

const providers: Provider<any>[] = [EmailService, HttpService, ImageService]

@Module({ imports: [], providers: providers, exports: providers })
@Global()
export class HelperModule {}
