import { Module } from '@nestjs/common'
import { NoteController } from './note.controller'
import { NoteService } from './note.service'
import { GatewayModule } from '~/processors/gateway/gateway.module'

@Module({
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService],
  imports: [GatewayModule],
})
export class NoteModule {}
