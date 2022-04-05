import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { NoteController } from './note.controller'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService],
  imports: [GatewayModule],
})
export class NoteModule {}
