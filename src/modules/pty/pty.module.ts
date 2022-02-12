import { Module } from '@nestjs/common'
import { PTYController } from './pty.controller'
import { PTYService } from './pty.service'

@Module({
  controllers: [PTYController],
  providers: [PTYService],
})
export class PTYModule {}
