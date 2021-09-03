import { Module } from '@nestjs/common'
import { EmailService } from './helper.email.service'

@Module({ imports: [], providers: [EmailService] })
export class HelperModule {}
