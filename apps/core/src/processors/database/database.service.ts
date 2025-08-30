import { Inject, Injectable } from '@nestjs/common'
import { mongoose, ReturnModelType } from '@typegoose/typegoose'
import type { ArticleTypeEnum } from '~/constants/article.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DB_CONNECTION_TOKEN } from '~/constants/system.constant'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { RecentlyModel } from '~/modules/recently/recently.model'
import type { WriteBaseModel } from '~/shared/model/write-base.model'
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
    @InjectModel(RecentlyModel)
    private readonly recentlyModel: ReturnModelType<typeof RecentlyModel>,
    @Inject(DB_CONNECTION_TOKEN) private connection: mongoose.Connection,
  ) {}

  // @ts-ignore
  public getModelByRefType(
    type: CollectionRefTypes,
  ): ReturnModelType<typeof WriteBaseModel>
  // @ts-ignore
  public getModelByRefType(
    type: ArticleTypeEnum,
  ): ReturnModelType<typeof WriteBaseModel>
  public getModelByRefType(type: 'post'): ReturnModelType<typeof PostModel>
  public getModelByRefType(
    type: CollectionRefTypes.Post,
  ): ReturnModelType<typeof PostModel>

  public getModelByRefType(type: 'note'): ReturnModelType<typeof NoteModel>
  public getModelByRefType(
    type: CollectionRefTypes.Note,
  ): ReturnModelType<typeof NoteModel>

  public getModelByRefType(type: 'page'): ReturnModelType<typeof PageModel>
  public getModelByRefType(
    type: CollectionRefTypes.Page,
  ): ReturnModelType<typeof PageModel>
  public getModelByRefType(
    type: 'recently',
  ): ReturnModelType<typeof RecentlyModel>
  public getModelByRefType(
    type: 'Recently',
  ): ReturnModelType<typeof RecentlyModel>
  public getModelByRefType(
    type: CollectionRefTypes.Recently,
  ): ReturnModelType<typeof RecentlyModel>
  public getModelByRefType(type: any) {
    type = type.toLowerCase() as any
    // FIXME: lowercase key
    const map = new Map<any, any>([
      ['post', this.postModel],
      ['note', this.noteModel],
      ['page', this.pageModel],
      ['recently', this.recentlyModel],

      [CollectionRefTypes.Post, this.postModel],
      [CollectionRefTypes.Note, this.noteModel],
      [CollectionRefTypes.Page, this.pageModel],
      [CollectionRefTypes.Recently, this.recentlyModel],
    ] as any)
    return map.get(type) as any as ReturnModelType<
      | typeof NoteModel
      | typeof PostModel
      | typeof PageModel
      | typeof RecentlyModel
    >
  }

  /**
   * find document by id in `post`, `note`, `page`, `recently` collections
   * @param id
   * @returns
   */
  // @ts-ignore
  public async findGlobalById(id: string): Promise<
    | {
        document: PostModel
        type: CollectionRefTypes.Post
      }
    | {
        document: NoteModel
        type: CollectionRefTypes.Note
      }
    | {
        document: PageModel
        type: CollectionRefTypes.Page
      }
    | {
        document: RecentlyModel
        type: CollectionRefTypes.Recently
      }
    | null
  >

  public async findGlobalById(id: string): Promise<null>
  public async findGlobalById(id: string) {
    const doc = await Promise.all([
      this.postModel.findById(id).populate('category').lean(),
      this.noteModel
        .findById(id)
        .lean({ autopopulate: true })
        .select('+password'),
      this.pageModel.findById(id).lean(),
      this.recentlyModel.findById(id).lean(),
    ])
    const index = doc.findIndex(Boolean)
    if (index == -1) {
      return {
        document: null,
        type: null,
      }
    }
    const document = doc[index]
    if (!document) return null
    return {
      document,

      type: [
        CollectionRefTypes.Post,
        CollectionRefTypes.Note,
        CollectionRefTypes.Page,
        CollectionRefTypes.Recently,
      ][index],
    }
  }

  public async findGlobalByIds(ids: string[]): Promise<IdsCollection>
  public async findGlobalByIds(ids: string[]) {
    const combinedCollection = await Promise.all([
      this.postModel
        .find({
          _id: { $in: ids },
        })
        .populate('category')
        .lean(),
      this.noteModel
        .find({
          _id: { $in: ids },
        })
        .lean({ autopopulate: true })
        .select('+password'),
      this.pageModel
        .find({
          _id: { $in: ids },
        })
        .lean(),
      this.recentlyModel
        .find({
          _id: { $in: ids },
        })
        .lean(),
    ])

    const result = combinedCollection.reduce((acc, list, index) => {
      return {
        ...acc,
        [(['posts', 'notes', 'pages', 'recentlies'] as const)[index]]: list,
      }
    }, {} as IdsCollection)

    return result as any
  }

  flatCollectionToMap(combinedCollection: IdsCollection) {
    const all = {} as Record<
      string,
      PostModel | NoteModel | PageModel | RecentlyModel
    >
    for (const key in combinedCollection) {
      const collection = combinedCollection[key]
      for (const item of collection) {
        all[item.id] = item
      }
    }
    return all
  }

  public get db() {
    return this.connection.db!
  }

  public get mongooseConnection() {
    return this.connection
  }

  public get client() {
    return this.connection.getClient()
  }
}

type IdsCollection = {
  posts: PostModel[]
  notes: NoteModel[]
  pages: PageModel[]
  recentlies: RecentlyModel[]
}
