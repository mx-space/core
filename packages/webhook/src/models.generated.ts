// Auto-generated from core module type definitions.
// Do not edit manually — run `bun scripts/extract-models.ts` to regenerate.

export enum BusinessEvents {
  GATEWAY_CONNECT = 'gateway.connect',
  GATEWAY_DISCONNECT = 'gateway.disconnect',
  VISITOR_ONLINE = 'visitor.online',
  VISITOR_OFFLINE = 'visitor.offline',
  AUTH_FAILED = 'auth.failed',
  COMMENT_CREATE = 'comment.create',
  COMMENT_DELETE = 'comment.delete',
  COMMENT_UPDATE = 'comment.update',
  POST_CREATE = 'post.create',
  POST_UPDATE = 'post.update',
  POST_DELETE = 'post.delete',
  NOTE_CREATE = 'note.create',
  NOTE_UPDATE = 'note.update',
  NOTE_DELETE = 'note.delete',
  PAGE_CREATE = 'page.create',
  PAGE_UPDATE = 'page.update',
  PAGE_DELETE = 'page.delete',
  TOPIC_CREATE = 'topic.create',
  TOPIC_UPDATE = 'topic.update',
  TOPIC_DELETE = 'topic.delete',
  CATEGORY_CREATE = 'category.create',
  CATEGORY_UPDATE = 'category.update',
  CATEGORY_DELETE = 'category.delete',
  SAY_CREATE = 'say.create',
  SAY_DELETE = 'say.delete',
  SAY_UPDATE = 'say.update',
  LINK_APPLY = 'link.apply',
  RECENTLY_CREATE = 'recently.create',
  RECENTLY_UPDATE = 'recently.update',
  RECENTLY_DELETE = 'recently.delete',
  AGGREGATE_UPDATE = 'aggregate.update',
  TRANSLATION_CREATE = 'translation.create',
  TRANSLATION_UPDATE = 'translation.update',
  TRANSLATION_DELETE = 'translation.delete',
  INSIGHTS_CREATE = 'insights.create',
  INSIGHTS_UPDATE = 'insights.update',
  INSIGHTS_DELETE = 'insights.delete',
  INSIGHTS_GENERATED = 'insights.generated',
  SUMMARY_GENERATED = 'summary.generated',
  CONTENT_REFRESH = 'content.refresh',
  IMAGE_REFRESH = 'image.refresh',
  IMAGE_FETCH = 'image.fetch',
  ADMIN_NOTIFICATION = 'admin.notification',
  ACTIVITY_LIKE = 'activity.like',
  ACTIVITY_UPDATE_PRESENCE = 'activity.update_presence',
  ACTIVITY_LEAVE_PRESENCE = 'activity.leave_presence',
  ARTICLE_READ_COUNT_UPDATE = 'article.read_count_update',
  AI_AGENT_MESSAGE = 'ai_agent.message',
  AI_AGENT_TOOL_EVENT = 'ai_agent.tool_event',
  AI_AGENT_CONFIRM_REQUEST = 'ai_agent.confirm_request',
  AI_AGENT_CONFIRM_RESULT = 'ai_agent.confirm_result',
  AI_AGENT_SESSION_STATE = 'ai_agent.session_state',
  COMPANION_PRESENCE_CHANGED = 'companion_presence.changed',
  TASK_UPDATE = 'task.update',
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
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Recently = 'recently',
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

export enum CategoryType {
  Category,
  Tag,
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

export enum RecentlyTypeEnum {
  Text = 'text',
  Link = 'link',
}

export interface BaseModel {
  id?: string
  created?: Date
}

export interface CountModel {
  read?: number
  like?: number
}

export interface BaseCommentIndexModel extends BaseModel {
  commentsIndex?: number
  allowComment?: boolean
}

export interface ImageModel {
  width?: number
  height?: number
  accent?: string
  type?: string
  src?: string
  thumbhash?: string
}

export interface WriteBaseModel extends BaseCommentIndexModel {
  title: string
  text: string
  contentFormat: ContentFormat
  content?: string
  images?: ImageModel[]
  modified?: Date | null
  meta?: Record<string, any>
}

export interface Coordinate {
  latitude: number
  longitude: number
}

export type CommentRefType = `${CollectionRefTypes}`

export interface CommentRow {
  id: string
  refType: CommentRefType
  refId: string
  author: string | null
  mail: string | null
  url: string | null
  text: string
  state: number
  parentCommentId: string | null
  rootCommentId: string | null
  replyCount: number
  latestReplyAt: Date | null
  isDeleted: boolean
  deletedAt: Date | null
  pin: boolean
  isWhispers: boolean
  avatar: string | null
  authProvider: string | null
  meta: string | null
  readerId: string | null
  editedAt: Date | null
  anchor: Record<string, unknown> | null
  ip: string | null
  agent: string | null
  location: string | null
  isOwnerReply: boolean
  countryCode: string | null
  createdAt: Date
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

export type CommentModel = CommentRow

export interface CategoryModel extends BaseModel {
  name: string
  type?: CategoryType
  slug: string
}

export interface TopicModel {
  id: string
  createdAt: string
  name: string
  slug: string
  description: string
  introduce: string | null
  icon: string | null
}

export interface LinkModel extends BaseModel {
  name: string
  url: string
  avatar?: string
  description?: string
  type?: LinkType
  state: LinkState
  email?: string
  hide?: boolean
}

export interface NoteRow {
  id: string
  nid: number
  title: string
  slug: string | null
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  isPublished: boolean
  hasPassword: boolean
  publicAt: Date | null
  mood: string | null
  weather: string | null
  bookmark: boolean
  coordinates: { latitude: number; longitude: number } | null
  location: string | null
  readCount: number
  likeCount: number
  topicId: string | null
  topic?: {
    id: string
    name: string
    slug: string
    description: string
    introduce: string | null
    icon: string | null
    createdAt: Date
  } | null
  createdAt: Date
  modifiedAt: Date | null
}

export type NoteModel = NoteRow & {
  password?: string | null
}

export type NormalizedNote = Omit<NoteModel, 'password' | 'topic'> & {
  topic: TopicModel
}

export interface PageRow {
  id: string
  title: string
  slug: string
  subtitle: string | null
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  order: number
  createdAt: Date
  modifiedAt: Date | null
}

export type PageModel = PageRow

export interface PostRow {
  id: string
  title: string
  slug: string
  text: string
  content: string | null
  contentFormat: string
  summary: string | null
  images: unknown[] | null
  meta: Record<string, unknown> | null
  tags: string[]
  modifiedAt: Date | null
  categoryId: string
  category?: {
    id: string
    name: string
    slug: string
    type: number
  }
  copyright: boolean
  isPublished: boolean
  isPremium: boolean
  readCount: number
  likeCount: number
  pinAt: Date | null
  pinOrder: number | null
  createdAt: Date
  related?: PostRelatedSummary[]
}

export interface PostRelatedSummary {
  id: string
  title: string
  slug: string
  summary: string | null
  categoryId: string
  category?: {
    id: string
    name: string
    slug: string
    type: number
  }
  createdAt: Date
  modifiedAt: Date | null
}

export type PostModel = PostRow & {
  relatedId?: string[]
}

export type NormalizedPost = Omit<PostModel, 'category'> & {
  category: CategoryModel
}

export interface EnrichmentImagePalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  thumbhash?: string
  palette?: EnrichmentImagePalette
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentResult<TRaw = unknown> {
  id?: string
  title: string
  description?: string
  thumbnailImage?: EnrichmentImage
  previewImage?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
  captureImage?: EnrichmentImage
  raw?: TRaw
}

export type RecentlyRefType = `${CollectionRefTypes}` | null

export interface RecentlyRow {
  id: string
  content: string
  type: string
  metadata: Record<string, unknown> | null
  refType: RecentlyRefType
  refId: string | null
  commentsIndex: number
  allowComment: boolean
  up: number
  down: number
  createdAt: Date
  modifiedAt: Date | null
}

export type RefType = {
  type: 'post' | 'note' | 'page'
  id: string
}

export type RecentlyModel = RecentlyRow

export type RecentlyWithEnrichment = RecentlyRow & {
  enrichments?: Record<string, EnrichmentResult>
  ref?: any
}

export interface SayModel {
  id: string
  text: string
  source: string | null
  author: string | null
  createdAt: Date
}

export interface ReaderModel extends BaseModel {
  email?: string | null
  emailVerified?: boolean
  name?: string | null
  handle?: string | null
  username?: string | null
  displayUsername?: string | null
  image?: string | null
  role?: string
}

export type PublicLiveDeskStateV2 = {
  schemaVersion: 2
  epoch: string
  revision: number
  projection: {
    availability: 'idle' | 'active'
    updatedAt: string
    expiresAt: string
    application: {
      displayName: string
      activity: { key: string | null; customLabel: string | null } | null
      window: { title: string } | null
      icon: { url: string } | null
    } | null
    media: {
      sessionId: string
      kind: 'unknown' | 'music' | 'podcast' | 'video'
      title: string | null
      artist: string | null
      album: string | null
      player: { displayName: string } | null
      playback: {
        state: 'playing' | 'paused'
        durationMs: number | null
        positionMs: number | null
        anchorAt: string
        rate: number
      }
      artwork: { url: string } | null
      link: { url: string } | null
    } | null
  } | null
}
