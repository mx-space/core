import { Injectable } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { NoteModel } from './note.model'

@Injectable()
export class NoteService {
  constructor(
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
  ) {}

  public get model() {
    return this.noteModel
  }
}
