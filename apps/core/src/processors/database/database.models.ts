import { ActivityModel } from '~/modules/activity/activity.model'
import { AIDeepReadingModel } from '~/modules/ai/ai-deep-reading/ai-deep-reading.model'
import { AISummaryModel } from '~/modules/ai/ai-summary/ai-summary.model'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { AuthnModel } from '~/modules/authn/authn.model'
import { CategoryModel } from '~/modules/category/category.model'
import { CommentModel } from '~/modules/comment/comment.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { LinkModel } from '~/modules/link/link.model'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { ProjectModel } from '~/modules/project/project.model'
import { ReaderModel } from '~/modules/reader/reader.model'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { SayModel } from '~/modules/say/say.model'
import { ServerlessStorageModel } from '~/modules/serverless/serverless.model'
import { SlugTrackerModel } from '~/modules/slug-tracker/slug-tracker.model'
import { SnippetModel } from '~/modules/snippet/snippet.model'
import { SubscribeModel } from '~/modules/subscribe/subscribe.model'
import { SyncUpdateModel } from '~/modules/sync-update/sync-update.model'
import { TopicModel } from '~/modules/topic/topic.model'
import { UserModel } from '~/modules/user/user.model'
import { WebhookEventModel } from '~/modules/webhook/webhook-event.model'
import { WebhookModel } from '~/modules/webhook/webhook.model'
import { getProviderByTypegooseClass } from '~/transformers/model.transformer'

export const databaseModels = [
  ActivityModel,
  AISummaryModel,
  AIDeepReadingModel,
  AnalyzeModel,
  AuthnModel,
  CategoryModel,
  CommentModel,
  LinkModel,
  NoteModel,
  OptionModel,
  PageModel,
  PostModel,
  ProjectModel,
  ReaderModel,
  RecentlyModel,
  SayModel,
  ServerlessStorageModel,
  SlugTrackerModel,
  SnippetModel,
  SubscribeModel,
  SyncUpdateModel,
  TopicModel,
  UserModel,
  WebhookEventModel,
  WebhookModel,
].map((model) => getProviderByTypegooseClass(model))
