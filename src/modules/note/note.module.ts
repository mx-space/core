import { Module } from '@nestjs/common'
import { NoteController } from './note.controller'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [NoteService],
  exports: [NoteService],
})
export class NoteModule {}
