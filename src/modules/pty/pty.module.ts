import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { PTYController } from './pty.controller'
import { PTYGateway } from './pty.gateway'
import { PTYService } from './pty.service'

@Module({
  imports: [AuthModule],
  controllers: [PTYController],
  providers: [PTYService, PTYGateway],
})
export class PTYModule {}
