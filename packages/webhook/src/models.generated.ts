// Auto-generated from core model definitions
// Do not edit manually - run `node scripts/extract-models.js` to regenerate

export enum BusinessEvents {
  GATEWAY_CONNECT = 'GATEWAY_CONNECT',
  GATEWAY_DISCONNECT = 'GATEWAY_DISCONNECT',
  VISITOR_ONLINE = 'VISITOR_ONLINE',
  VISITOR_OFFLINE = 'VISITOR_OFFLINE',
  AUTH_FAILED = 'AUTH_FAILED',
  COMMENT_CREATE = 'COMMENT_CREATE',
  COMMENT_DELETE = 'COMMENT_DELETE',
  COMMENT_UPDATE = 'COMMENT_UPDATE',
  POST_CREATE = 'POST_CREATE',
  POST_UPDATE = 'POST_UPDATE',
  POST_DELETE = 'POST_DELETE',
  NOTE_CREATE = 'NOTE_CREATE',
  NOTE_UPDATE = 'NOTE_UPDATE',
  NOTE_DELETE = 'NOTE_DELETE',
  PAGE_CREATE = 'PAGE_CREATE',
  PAGE_UPDATE = 'PAGE_UPDATE',
  PAGE_DELETE = 'PAGE_DELETE',
  TOPIC_CREATE = 'TOPIC_CREATE',
  TOPIC_UPDATE = 'TOPIC_UPDATE',
  TOPIC_DELETE = 'TOPIC_DELETE',
  CATEGORY_CREATE = 'CATEGORY_CREATE',
  CATEGORY_UPDATE = 'CATEGORY_UPDATE',
  CATEGORY_DELETE = 'CATEGORY_DELETE',
  SAY_CREATE = 'SAY_CREATE',
  SAY_DELETE = 'SAY_DELETE',
  SAY_UPDATE = 'SAY_UPDATE',
  LINK_APPLY = 'LINK_APPLY',
  RECENTLY_CREATE = 'RECENTLY_CREATE',
  RECENTLY_UPDATE = 'RECENTLY_UPDATE',
  RECENTLY_DELETE = 'RECENTLY_DELETE',
  AGGREGATE_UPDATE = 'AGGREGATE_UPDATE',
  TRANSLATION_CREATE = 'TRANSLATION_CREATE',
  TRANSLATION_UPDATE = 'TRANSLATION_UPDATE',
  CONTENT_REFRESH = 'CONTENT_REFRESH',
  IMAGE_REFRESH = 'IMAGE_REFRESH',
  IMAGE_FETCH = 'IMAGE_FETCH',
  ADMIN_NOTIFICATION = 'ADMIN_NOTIFICATION',
  ACTIVITY_LIKE = 'ACTIVITY_LIKE',
  ACTIVITY_UPDATE_PRESENCE = 'ACTIVITY_UPDATE_PRESENCE',
  ACTIVITY_LEAVE_PRESENCE = 'ACTIVITY_LEAVE_PRESENCE',
  ARTICLE_READ_COUNT_UPDATE = 'ARTICLE_READ_COUNT_UPDATE',
  AI_AGENT_MESSAGE = 'AI_AGENT_MESSAGE',
  AI_AGENT_TOOL_EVENT = 'AI_AGENT_TOOL_EVENT',
  AI_AGENT_CONFIRM_REQUEST = 'AI_AGENT_CONFIRM_REQUEST',
  AI_AGENT_CONFIRM_RESULT = 'AI_AGENT_CONFIRM_RESULT',
  AI_AGENT_SESSION_STATE = 'AI_AGENT_SESSION_STATE',
}

export enum EventScope {
  TO_VISITOR = 1 << 0,
  TO_ADMIN = 1 << 1,
  TO_SYSTEM = 1 << 2,
  TO_VISITOR_ADMIN = (1 << 0) | (1 << 1),
  TO_SYSTEM_VISITOR = (1 << 0) | (1 << 2),
  TO_SYSTEM_ADMIN = (1 << 1) | (1 << 2),
  ALL = (1 << 0) | (1 << 1) | (1 << 2),
}

export enum ContentFormat {
  Markdown = 'markdown',
  Lexical = 'lexical',
}

export enum CollectionRefTypes {
  Post = 'posts',
  Note = 'notes',
  Page = 'pages',
  Recently = 'recentlies',
}

export interface ImageModel {
  width?: number
  height?: number
  accent?: string
  type?: string
  src?: string
  blurHash?: string
}

export interface CountModel {
  read?: number
  like?: number
}

export interface BaseModel {
  created?: Date
  id: string
}

export interface BaseCommentIndexModel extends BaseModel {
  commentsIndex?: number
  allowComment: boolean
}

export interface WriteBaseModel extends BaseCommentIndexModel {
  title: string
  text: string
  contentFormat: ContentFormat
  content?: string
  images?: ImageModel[]
  modified: Date | null
  created?: Date
  meta?: Record<string, any>
}

export interface Coordinate {
  latitude: number
  longitude: number
}

export enum CommentState {
  Unread,
  Read,
  Junk,
}

export enum CommentAnchorMode {
  Block = 'block',
  Range = 'range',
}

export interface CommentAnchorModel {
  mode: CommentAnchorMode
  blockId: string
  blockType?: string
  blockFingerprint?: string
  snapshotText?: string
  quote?: string
  prefix?: string
  suffix?: string
  startOffset?: number
  endOffset?: number
  contentHashAtCreate?: string
  contentHashCurrent?: string
  lastResolvedAt?: Date
  lang?: string | null
}

export interface CommentModel extends BaseModel {
  ref: string
  refType: CollectionRefTypes
  author?: string
  mail: string
  url?: string
  text: string
  state?: CommentState
  parentCommentId?: string | null
  rootCommentId?: string
  replyCount?: number
  latestReplyAt?: Date
  isDeleted?: boolean
  deletedAt?: Date
  ip?: string
  agent?: string
  pin?: boolean
  post: string
  note: string
  page: string
  recently: string
  location?: string
  isWhispers?: boolean
  avatar?: string
  authProvider?: string
  meta?: string
  readerId?: string
  editedAt?: Date
  anchor?: CommentAnchorModel
}

export enum CategoryType {
  Category,
  Tag,
}

export interface CategoryModel extends BaseModel {
  name: string
  type?: CategoryType
  slug: string
}

export interface TopicModel extends BaseModel {
  description?: string
  introduce: string
  name: string
  slug: string
  icon?: string
}

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
  Reject,
}

export interface LinkModel extends BaseModel {
  name: string
  url: string
  avatar?: string
  description?: string
  type?: LinkType
  state: LinkState
  email?: string
}

export interface NoteModel extends WriteBaseModel {
  title: string
  nid: number
  slug?: string
  isPublished?: boolean
  password: string | null
  publicAt: Date | null
  mood?: string
  weather?: string
  bookmark: boolean
  coordinates?: Coordinate
  location?: string
  count: CountModel
  topicId?: string
  topic?: TopicModel
}

export interface PageModel extends WriteBaseModel {
  slug: string
  subtitle?: string | null
  order: number
}

export interface PostModel extends WriteBaseModel {
  slug: string
  summary: string | null
  categoryId: string
  category: string
  copyright?: boolean
  isPublished?: boolean
  tags?: string[]
  count: CountModel
  pin?: Date | null
  pinOrder?: number
  relatedId?: string[]
  related: Partial<PostModel>[]
}

export type RefType = {
  title: string
  url: string
}

export interface RecentlyModel extends BaseCommentIndexModel {
  content: string
  type: RecentlyTypeEnum
  metadata?: Record<string, any>
  ref: RefType
  refType: CollectionRefTypes
  modified?: Date
  up: number
  down: number
}

export interface SayModel extends BaseModel {
  text: string
  source: string
  author: string
}

export interface ReaderModel extends BaseModel {
  email: string
  name: string
  handle: string
  image: string
  role: 'reader' | 'owner'
}

export type NormalizedNote = Omit<NoteModel, 'password' | 'topic'> & {
  topic: TopicModel
}

export type NormalizedPost = Omit<PostModel, 'category'> & {
  category: CategoryModel
}
