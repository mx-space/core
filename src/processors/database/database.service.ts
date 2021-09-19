import { Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'

declare enum ModelRefTypes {
  Post,
  Note,
  Page,
}

@Injectable()
export class DatabaseService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: ReturnModelType<typeof NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: ReturnModelType<typeof PageModel>,
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
      this.noteModel.findById(id).lean(),
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
}
