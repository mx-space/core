import { Global, Module } from '@nestjs/common'
import { EmailService } from './helper.email.service'

@Module({ imports: [], providers: [EmailService], exports: [EmailService] })
@Global()
export class HelperModule {}
