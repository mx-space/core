import { Injectable } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { CommentModel } from './comment.model'

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,
  ) {}
}
