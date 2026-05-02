import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { createdAt, pkBigInt, refBigInt, tsCol, updatedAt } from './columns'

export const categories = pgTable(
  'categories',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: integer('type').notNull().default(0),
  },
  (table) => [
    uniqueIndex('categories_name_uniq').on(table.name),
    uniqueIndex('categories_slug_uniq').on(table.slug),
  ],
)

export const topics = pgTable(
  'topics',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    introduce: text('introduce'),
    icon: text('icon'),
  },
  (table) => [
    uniqueIndex('topics_name_uniq').on(table.name),
    uniqueIndex('topics_slug_uniq').on(table.slug),
  ],
)

export const posts = pgTable(
  'posts',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    text: text('text'),
    content: text('content'),
    contentFormat: text('content_format').notNull(),
    summary: text('summary'),
    images: jsonb('images').$type<unknown[]>(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    modifiedAt: tsCol('modified_at'),
    categoryId: refBigInt('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    copyright: boolean('copyright').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(true),
    readCount: integer('read_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    pinAt: tsCol('pin_at'),
    pinOrder: integer('pin_order'),
  },
  (table) => [
    uniqueIndex('posts_slug_uniq').on(table.slug),
    index('posts_modified_at_idx').on(table.modifiedAt),
    index('posts_created_at_idx').on(table.createdAt),
    index('posts_category_id_idx').on(table.categoryId),
  ],
)

export const postRelatedPosts = pgTable(
  'post_related_posts',
  {
    postId: refBigInt('post_id')
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: 'cascade' }),
    relatedPostId: refBigInt('related_post_id')
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    uniqueIndex('post_related_posts_pk').on(table.postId, table.relatedPostId),
    index('post_related_posts_related_idx').on(table.relatedPostId),
  ],
)

export const notes = pgTable(
  'notes',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    nid: integer('nid').notNull(),
    title: text('title'),
    slug: text('slug'),
    text: text('text'),
    content: text('content'),
    contentFormat: text('content_format').notNull(),
    images: jsonb('images').$type<unknown[]>(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    isPublished: boolean('is_published').notNull().default(true),
    password: text('password'),
    publicAt: tsCol('public_at'),
    mood: text('mood'),
    weather: text('weather'),
    bookmark: boolean('bookmark').notNull().default(false),
    coordinates: jsonb('coordinates').$type<{
      latitude: number
      longitude: number
    } | null>(),
    location: text('location'),
    readCount: integer('read_count').notNull().default(0),
    likeCount: integer('like_count').notNull().default(0),
    topicId: refBigInt('topic_id').references(() => topics.id, {
      onDelete: 'set null',
    }),
    modifiedAt: tsCol('modified_at'),
  },
  (table) => [
    uniqueIndex('notes_nid_uniq').on(table.nid),
    uniqueIndex('notes_slug_uniq')
      .on(table.slug)
      .where(sql`${table.slug} is not null`),
    index('notes_nid_desc_idx').on(table.nid),
    index('notes_modified_at_idx').on(table.modifiedAt),
    index('notes_created_at_idx').on(table.createdAt),
    index('notes_topic_id_idx').on(table.topicId),
  ],
)

export const pages = pgTable(
  'pages',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    subtitle: text('subtitle'),
    text: text('text'),
    content: text('content'),
    contentFormat: text('content_format').notNull(),
    images: jsonb('images').$type<unknown[]>(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    order: integer('order').notNull().default(1),
    modifiedAt: tsCol('modified_at'),
  },
  (table) => [
    uniqueIndex('pages_slug_uniq').on(table.slug),
    index('pages_order_idx').on(table.order),
  ],
)

/**
 * Polymorphic content reference (`Post` | `Note` | `Page` | `Recently`).
 * The actual reference is validated by repository code.
 */
export const recentlies = pgTable(
  'recentlies',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    content: text('content').notNull().default(''),
    type: text('type').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    refType: text('ref_type'),
    refId: refBigInt('ref_id'),
    commentsIndex: integer('comments_index').notNull().default(0),
    allowComment: boolean('allow_comment').notNull().default(true),
    modifiedAt: tsCol('modified_at'),
    up: integer('up').notNull().default(0),
    down: integer('down').notNull().default(0),
  },
  (table) => [
    index('recentlies_ref_idx').on(table.refType, table.refId),
    index('recentlies_created_at_idx').on(table.createdAt),
  ],
)

export const drafts = pgTable(
  'drafts',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    refType: text('ref_type').notNull(),
    refId: refBigInt('ref_id'),
    title: text('title').notNull().default(''),
    text: text('text').notNull().default(''),
    content: text('content'),
    contentFormat: text('content_format').notNull(),
    images: jsonb('images').$type<unknown[]>(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    typeSpecificData: jsonb('type_specific_data').$type<Record<
      string,
      unknown
    > | null>(),
    history: jsonb('history').$type<unknown[] | null>(),
    version: integer('version').notNull().default(1),
    publishedVersion: integer('published_version'),
  },
  (table) => [
    index('drafts_ref_idx')
      .on(table.refType, table.refId)
      .where(sql`${table.refId} is not null`),
    index('drafts_updated_at_idx').on(table.updatedAt),
  ],
)

/**
 * Optional separate-table form for draft history. Only populated when
 * indexed lookup across drafts is required (Phase 0 deferred).
 */
export const draftHistories = pgTable(
  'draft_histories',
  {
    id: pkBigInt(),
    draftId: refBigInt('draft_id')
      .notNull()
      .references(() => drafts.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    text: text('text'),
    content: text('content'),
    contentFormat: text('content_format').notNull(),
    typeSpecificData: jsonb('type_specific_data').$type<Record<
      string,
      unknown
    > | null>(),
    savedAt: tsCol('saved_at').notNull(),
    isFullSnapshot: boolean('is_full_snapshot').notNull(),
    refVersion: integer('ref_version'),
    baseVersion: integer('base_version'),
  },
  (table) => [
    uniqueIndex('draft_histories_draft_version_uniq').on(
      table.draftId,
      table.version,
    ),
  ],
)

/**
 * Self-referential thread structure plus polymorphic ref to content (Post/Note/Page/Recently).
 */
export const comments = pgTable(
  'comments',
  {
    id: pkBigInt(),
    createdAt: createdAt(),
    refType: text('ref_type').notNull(),
    refId: refBigInt('ref_id').notNull(),
    author: text('author'),
    mail: text('mail'),
    url: text('url'),
    text: text('text').notNull(),
    state: integer('state').notNull().default(0),
    parentCommentId: refBigInt('parent_comment_id').references(
      (): AnyPgColumn => comments.id,
      { onDelete: 'cascade' },
    ),
    rootCommentId: refBigInt('root_comment_id').references(
      (): AnyPgColumn => comments.id,
      { onDelete: 'cascade' },
    ),
    replyCount: integer('reply_count').notNull().default(0),
    latestReplyAt: tsCol('latest_reply_at'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: tsCol('deleted_at'),
    ip: text('ip'),
    agent: text('agent'),
    pin: boolean('pin').notNull().default(false),
    location: text('location'),
    isWhispers: boolean('is_whispers').notNull().default(false),
    avatar: text('avatar'),
    authProvider: text('auth_provider'),
    meta: text('meta'),
    readerId: refBigInt('reader_id'),
    editedAt: tsCol('edited_at'),
    anchor: jsonb('anchor').$type<Record<string, unknown> | null>(),
  },
  (table) => [
    index('comments_thread_idx').on(
      table.refType,
      table.refId,
      table.parentCommentId,
      table.pin,
      table.createdAt,
    ),
    index('comments_root_idx').on(table.rootCommentId, table.createdAt),
    index('comments_reader_idx').on(table.readerId),
  ],
)
