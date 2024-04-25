import { AckController } from './ack'
import { ActivityController } from './activity'
import { AggregateController } from './aggregate'
import { AIController } from './ai'
import { CategoryController } from './category'
import { CommentController } from './comment'
import { LinkController } from './link'
import { NoteController } from './note'
import { PageController } from './page'
import { PostController } from './post'
import { ProjectController } from './project'
import {
  RecentlyAttitudeEnum,
  RecentlyAttitudeResultEnum,
  RecentlyController,
} from './recently'
import { SayController } from './say'
import { SearchController } from './search'
import { ServerlessController } from './severless'
import { SnippetController } from './snippet'
import { SubscribeController } from './subscribe'
import { TopicController } from './topic'
import { UserController } from './user'

export const allControllers = [
  AIController,
  AckController,
  ActivityController,
  AggregateController,
  CategoryController,
  CommentController,
  LinkController,
  NoteController,
  PageController,
  PostController,
  ProjectController,
  RecentlyController,
  TopicController,
  SayController,
  SearchController,
  SnippetController,
  ServerlessController,
  SubscribeController,
  UserController,
]

export const allControllerNames = [
  'ai',
  'ack',
  'activity',
  'aggregate',
  'category',
  'comment',
  'link',
  'note',
  'page',
  'post',
  'project',
  'topic',
  'recently',
  'say',
  'search',
  'snippet',
  'serverless',
  'subscribe',
  'user',

  // alias,
  'friend',
  'master',
  'shorthand',
] as const

export {
  AIController,
  AckController,
  ActivityController,
  AggregateController,
  CategoryController,
  CommentController,
  LinkController,
  NoteController,
  PageController,
  PostController,
  ProjectController,
  RecentlyController,
  SayController,
  SearchController,
  SnippetController,
  ServerlessController,
  SubscribeController,
  UserController,
  TopicController,

  // Enum
  RecentlyAttitudeEnum,
  RecentlyAttitudeResultEnum,
}
