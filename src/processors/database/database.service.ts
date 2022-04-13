import { Inject, Injectable } from '@nestjs/common'
import { ReturnModelType, mongoose } from '@typegoose/typegoose'

import { DB_CONNECTION_TOKEN } from '~/constants/system.constant'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { InjectModel } from '~/transformers/model.transformer'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: ReturnModelType<typeof NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: ReturnModelType<typeof PageModel>,
    @Inject(DB_CONNECTION_TOKEN) private connection: mongoose.Connection,
  ) {}

  // @ts-ignore
  public getModelByRefType(type: 'Post'): ReturnModelType<typeof PostModel>
  public getModelByRefType(type: 'post'): ReturnModelType<typeof PostModel>
  public getModelByRefType(type: 'Note'): ReturnModelType<typeof NoteModel>
  public getModelByRefType(type: 'note'): ReturnModelType<typeof NoteModel>
  public getModelByRefType(type: 'Page'): ReturnModelType<typeof PageModel>
  public getModelByRefType(type: 'page'): ReturnModelType<typeof PageModel>
  public getModelByRefType(type: any) {
    type = type.toLowerCase() as any
    // FIXME: lowercase key
    const map = new Map<any, any>([
      ['post', this.postModel],
      ['note', this.noteModel],
      ['page', this.pageModel],
    ] as any)
    return map.get(type) as any as ReturnModelType<
      typeof NoteModel | typeof PostModel | typeof PageModel
    >
  }

  public async findGlobalById(id: string) {
    const doc = await Promise.all([
      this.postModel.findById(id).populate('category').lean(),
      this.noteModel.findById(id).lean().select('+password'),
      this.pageModel.findById(id).lean(),
    ])
    const index = doc.findIndex(Boolean)
    if (index == -1) {
      return {
        document: null,
        type: null,
      }
    }
    const document = doc[index]
    return {
      document,
      type: ['Post', 'Note', 'Page'][index],
    }
  }

  public get db() {
    return this.connection.db
  }
}
