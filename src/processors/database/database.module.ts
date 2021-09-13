import { Global, Module } from '@nestjs/common'
import { TypegooseModule } from 'nestjs-typegoose'
import { MONGO_DB } from '~/app.config'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { LinkModel } from '~/modules/link/link.model'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { ProjectModel } from '~/modules/project/project.model'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { SayModel } from '~/modules/say/say.model'
import { CategoryModel } from '../../modules/category/category.model'
import { PostModel } from '../../modules/post/post.model'
import { UserModel } from '../../modules/user/user.model'
import { DatabaseService } from './database.service'

const models = TypegooseModule.forFeature([
  AnalyzeModel,
  CategoryModel,
  CommentModel,
  LinkModel,
  NoteModel,
  OptionModel,
  PageModel,
  PostModel,
  ProjectModel,
  RecentlyModel,
  SayModel,
  UserModel,
])
@Module({
  imports: [
    TypegooseModule.forRootAsync({
      useFactory: () => ({
        uri: MONGO_DB.uri,
        useCreateIndex: true,
        useFindAndModify: false,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: true,
      }),
    }),
    models,
  ],
  providers: [DatabaseService],
  exports: [models, DatabaseService],
})
@Global()
export class DbModule {}
