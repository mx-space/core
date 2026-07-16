import { AckController } from './ack'
import { ActivityController } from './activity'
import { AggregateController } from './aggregate'
import { AIController } from './ai'
import { CategoryController } from './category'
import { CommentController } from './comment'
import { CompanionController } from './companion'
import { EnrichmentController } from './enrichment'
import { LinkController } from './link'
import type {
  NoteMiddleListOptions,
  NoteTimelineItem,
  NoteTopicListOptions,
} from './note'
import { NoteController } from './note'
import { UserController } from './owner'
import { PageController } from './page'
import type { PostListOptions } from './post'
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

export const allControllers = [
  AckController,
  ActivityController,
  AggregateController,
  AIController,
  CategoryController,
  CommentController,
  CompanionController,
  EnrichmentController,
  LinkController,
  NoteController,
  PageController,
  PostController,
  ProjectController,
  RecentlyController,
  SayController,
  SearchController,
  ServerlessController,
  SnippetController,
  SubscribeController,
  TopicController,
  UserController,
]

export const allControllerNames = [
  'ai',
  'ack',
  'activity',
  'aggregate',
  'category',
  'comment',
  'companion',
  'enrichment',
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
  'owner',

  // alias,
  'friend',
  'shorthand',
] as const

export {
  AckController,
  ActivityController,
  AggregateController,
  AIController,
  CategoryController,
  CommentController,
  CompanionController,
  EnrichmentController,
  LinkController,
  NoteController,
  PageController,
  PostController,
  ProjectController,
  // Enum
  RecentlyAttitudeEnum,
  RecentlyAttitudeResultEnum,
  RecentlyController,
  SayController,
  SearchController,
  ServerlessController,
  SnippetController,
  SubscribeController,
  TopicController,
  UserController,
}

export type { NoteMiddleListOptions, NoteTimelineItem, NoteTopicListOptions }
export type { PostListOptions }
