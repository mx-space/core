import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { CommentModel } from './comment.model'
@Injectable()
export class CommentService {
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: ReturnModelType<typeof NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: ReturnModelType<typeof PageModel>,
    private readonly configs: ConfigsService,
  ) {}
}
