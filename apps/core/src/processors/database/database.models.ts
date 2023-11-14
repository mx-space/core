import { ActivityModel } from '~/modules/activity/activity.model'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { CategoryModel } from '~/modules/category/category.model'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { LinkModel } from '~/modules/link/link.model'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { ProjectModel } from '~/modules/project/project.model'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { SayModel } from '~/modules/say/say.model'
import { ServerlessStorageModel } from '~/modules/serverless/serverless.model'
import { SnippetModel } from '~/modules/snippet/snippet.model'
import { SubscribeModel } from '~/modules/subscribe/subscribe.model'
import { SyncUpdateModel } from '~/modules/sync-update/sync-update.model'
import { TopicModel } from '~/modules/topic/topic.model'
import { UserModel } from '~/modules/user/user.model'
import { getProviderByTypegooseClass } from '~/transformers/model.transformer'

export const databaseModels = [
  ActivityModel,
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
  TopicModel,
  SayModel,
  ServerlessStorageModel,
  SnippetModel,
  SubscribeModel,
  UserModel,
  SyncUpdateModel,
].map((model) => getProviderByTypegooseClass(model))
