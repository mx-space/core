import { Global, Module } from '@nestjs/common'

import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { LinkModel } from '~/modules/link/link.model'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { ProjectModel } from '~/modules/project/project.model'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { SayModel } from '~/modules/say/say.model'
import { SnippetModel } from '~/modules/snippet/snippet.model'
import { getProviderByTypegooseClass } from '~/transformers/model.transformer'

import { CategoryModel } from '../../modules/category/category.model'
import { PostModel } from '../../modules/post/post.model'
import { UserModel } from '../../modules/user/user.model'
import { databaseProvider } from './database.provider'
import { DatabaseService } from './database.service'

const models = [
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
  SnippetModel,
  UserModel,
].map((model) => getProviderByTypegooseClass(model))
@Module({
  providers: [DatabaseService, databaseProvider, ...models],
  exports: [DatabaseService, databaseProvider, ...models],
})
@Global()
export class DatabaseModule {}
