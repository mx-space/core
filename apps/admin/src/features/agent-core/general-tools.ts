import { getCategories } from '~/api/categories'
import { getComments, replyComment } from '~/api/comments'
import type { PostSortKey, PostSortOrder } from '~/api/posts'
import { getPosts, patchPost, searchPosts } from '~/api/posts'

import type { AgentToolDefinition } from './turn-loop'

export function createGeneralAgentTools(): AgentToolDefinition[] {
  return [
    {
      kind: 'read',
      manifest: {
        name: 'searchPosts',
        description:
          'Search published posts by keyword and return a compact operational summary.',
        parameters: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            page: { type: 'number' },
            size: { type: 'number' },
          },
          required: ['keyword'],
        },
      },
      read: async (args) => {
        const keyword = readString(args.keyword)?.trim()
        if (!keyword) {
          return {
            content: JSON.stringify({
              error:
                'searchPosts requires a non-empty `keyword` string (whitespace-only is rejected). To browse posts without a search query, call `listPosts` instead.',
            }),
            isError: true,
          }
        }
        const page = readPositiveNumber(args.page, 1)
        const size = Math.min(readPositiveNumber(args.size, 10), 20)
        const result = await searchPosts({ keyword, page, size })
        return {
          content: JSON.stringify({
            total: result.pagination.total,
            page,
            size,
            posts: result.data.map((post) => ({
              id: post.id,
              title: post.title,
              slug: post.slug,
              createdAt: post.createdAt,
              modifiedAt: post.modifiedAt,
            })),
          }),
        }
      },
    },
    {
      kind: 'read',
      manifest: {
        name: 'listPosts',
        description:
          'List published posts ordered by createdAt/modifiedAt/pinAt. Use this for browse intents such as "show me recent posts" or "what posts are there". Use `searchPosts` only when the user provides a concrete keyword.',
        parameters: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
            page: { type: 'number' },
            size: { type: 'number' },
            sortBy: {
              enum: ['createdAt', 'modifiedAt', 'pinAt'],
              type: 'string',
            },
            sortOrder: { enum: ['asc', 'desc'], type: 'string' },
          },
        },
      },
      read: async (args) => {
        const page = readPositiveNumber(args.page, 1)
        const size = Math.min(readPositiveNumber(args.size, 10), 20)
        const categoryId = readString(args.categoryId)?.trim()
        const sortBy = readPostSortKey(args.sortBy)
        const sortOrder = readPostSortOrder(args.sortOrder)
        const result = await getPosts({
          categoryIds: categoryId ? [categoryId] : undefined,
          page,
          size,
          sort_by: sortBy,
          sort_order: sortOrder,
        })
        return {
          content: JSON.stringify({
            total: result.pagination.total,
            page,
            size,
            posts: result.data.map((post) => ({
              id: post.id,
              title: post.title,
              slug: post.slug,
              createdAt: post.createdAt,
              modifiedAt: post.modifiedAt,
            })),
          }),
        }
      },
    },
    {
      kind: 'read',
      manifest: {
        name: 'readComments',
        description:
          'Read comments by moderation state and return a compact summary.',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            size: { type: 'number' },
            state: { type: 'number' },
          },
        },
      },
      read: async (args) => {
        const page = readPositiveNumber(args.page, 1)
        const size = Math.min(readPositiveNumber(args.size, 10), 20)
        const state = readNumber(args.state, 0)
        const result = await getComments({ page, size, state })
        return {
          content: JSON.stringify({
            total: result.pagination.total,
            page,
            size,
            comments: result.data.map((comment) => ({
              id: comment.id,
              author: comment.author,
              text: comment.text,
              createdAt: comment.createdAt,
              state: comment.state,
            })),
          }),
        }
      },
    },
    {
      kind: 'read',
      manifest: {
        name: 'queryCategories',
        description: 'Read categories or tags and return their identifiers.',
        parameters: {
          type: 'object',
          properties: {
            type: { enum: ['Category', 'Tag', 'tag'], type: 'string' },
          },
        },
      },
      read: async (args) => {
        const type = readCategoryType(args.type)
        const result = await getCategories(type ? { type } : undefined)
        return {
          content: JSON.stringify({
            categories: result.map((category) => ({
              count: category.count,
              id: 'id' in category ? category.id : undefined,
              name: category.name,
              slug: 'slug' in category ? category.slug : undefined,
              type: 'type' in category ? category.type : undefined,
            })),
          }),
        }
      },
    },
    {
      kind: 'draftPatch',
      manifest: {
        name: 'draftPostPatch',
        description:
          'Prepare a dry-run for batch post metadata edits. This never writes.',
        parameters: {
          type: 'object',
          properties: {
            patch: { type: 'object' },
            postIds: { items: { type: 'string' }, type: 'array' },
          },
          required: ['postIds', 'patch'],
        },
      },
      dryRun: async (args) => {
        const postIds = Array.isArray(args.postIds)
          ? args.postIds.filter((id): id is string => typeof id === 'string')
          : []
        const patch =
          args.patch && typeof args.patch === 'object' ? args.patch : {}
        const payload = { patch, postIds }

        return {
          blockingReasons:
            postIds.length === 0 ? ['No post ids were provided.'] : [],
          dryRunHash: hashPayload(payload),
          summary: JSON.stringify({
            affected: postIds.length,
            patch,
            postIds,
          }),
        }
      },
      execute: async (args) => {
        const postIds = Array.isArray(args.postIds)
          ? args.postIds.filter((id): id is string => typeof id === 'string')
          : []
        const patch =
          args.patch && typeof args.patch === 'object'
            ? (args.patch as Record<string, unknown>)
            : {}

        const results = await Promise.allSettled(
          postIds.map((postId) => patchPost(postId, patch)),
        )
        const success = results.filter(
          (result) => result.status === 'fulfilled',
        ).length
        const failed = results.length - success

        return {
          content: JSON.stringify({ failed, success, total: results.length }),
          isError: failed > 0,
        }
      },
    },
    {
      kind: 'replyDraft',
      manifest: {
        name: 'draftCommentReply',
        description:
          'Prepare a comment reply draft. Publishing requires explicit confirmation.',
        parameters: {
          type: 'object',
          properties: {
            commentId: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['commentId', 'text'],
        },
      },
      dryRun: async (args) => ({
        blockingReasons: readString(args.commentId)
          ? []
          : ['Missing comment id.'],
        dryRunHash: hashPayload(args),
        summary: JSON.stringify({
          commentId: readString(args.commentId) ?? null,
          text: readString(args.text) ?? '',
        }),
      }),
      execute: async (args) => {
        const commentId = readString(args.commentId)
        const text = readString(args.text)
        if (!commentId || !text) {
          return { content: 'Missing comment id or reply text.', isError: true }
        }
        await replyComment(commentId, text)
        return {
          content: JSON.stringify({ commentId, published: true }),
        }
      },
    },
  ]
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readPositiveNumber(value: unknown, fallback: number) {
  const number = readNumber(value, fallback)
  return number > 0 ? Math.floor(number) : fallback
}

function readCategoryType(
  value: unknown,
): 'Category' | 'Tag' | 'tag' | undefined {
  return value === 'Category' || value === 'Tag' || value === 'tag'
    ? value
    : undefined
}

function readPostSortKey(value: unknown): PostSortKey | undefined {
  return value === 'createdAt' || value === 'modifiedAt' || value === 'pinAt'
    ? value
    : undefined
}

function readPostSortOrder(value: unknown): PostSortOrder | undefined {
  return value === 'asc' || value === 'desc' ? value : undefined
}

function hashPayload(payload: unknown) {
  const input = JSON.stringify(payload)
  let hash = 5381
  for (const char of input) {
    hash = (hash * 33) ^ char.charCodeAt(0)
  }
  return `dry-${(hash >>> 0).toString(16)}`
}
