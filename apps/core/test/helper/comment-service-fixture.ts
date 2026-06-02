import { vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { CommentState } from '~/modules/comment/comment.enum'
import type {
  CommentRepository,
  CommentRow,
} from '~/modules/comment/comment.repository'
import { CommentService } from '~/modules/comment/comment.service'

import { createPgRepositoryMock, now } from './pg-repository-mock'

export const createCommentRow = (
  overrides: Partial<CommentRow> = {},
): CommentRow =>
  ({
    id: 'comment-1',
    text: 'hello',
    author: 'Alice',
    mail: 'alice@example.com',
    url: null,
    avatar: null,
    authProvider: null,
    meta: null,
    anchor: null,
    ip: '127.0.0.1',
    agent: null,
    location: null,
    state: CommentState.Unread,
    refId: 'post-1',
    refType: CollectionRefTypes.Post,
    parentCommentId: null,
    rootCommentId: null,
    readerId: null,
    isWhispers: false,
    isDeleted: false,
    pin: false,
    isOwnerReply: false,
    countryCode: null,
    createdAt: now,
    updatedAt: null,
    editedAt: null,
    ...overrides,
  }) as any

export const createCommentServiceFixture = () => {
  const repository = createPgRepositoryMock<CommentRepository>()
  const databaseService = {
    findGlobalById: vi.fn().mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: { id: 'post-1', allowComment: true },
    }),
    findGlobalByIds: vi.fn().mockResolvedValue({
      posts: [
        {
          id: 'post-1',
          title: 'Post',
          slug: 'post',
          category: { name: 'Default', slug: 'default' },
        },
      ],
      notes: [],
      pages: [],
      recentlies: [],
    }),
    flatCollectionToMap: vi.fn().mockReturnValue({
      'post-1': {
        id: 'post-1',
        title: 'Post',
        slug: 'post',
        category: { name: 'Default', slug: 'default' },
      },
    }),
  }
  const ownerService = {
    isOwnerName: vi.fn().mockResolvedValue(false),
    getOwner: vi
      .fn()
      .mockResolvedValue({ name: 'Owner', avatar: null, mail: null }),
  }
  const eventManager = { broadcast: vi.fn() }
  const readerService = { findReaderInIds: vi.fn().mockResolvedValue([]) }
  const fileReferenceService = { hardDeleteFilesForComment: vi.fn() }
  const commentCountryService = {
    lookupCountryCode: vi.fn().mockResolvedValue(null),
  }
  const redisStore = new Map<string, string>()
  const redisClient = {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key)
      return 1
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, '')
      return [...redisStore.keys()].filter((key) => key.startsWith(prefix))
    }),
  }
  const redisService = { getClient: () => redisClient } as any
  const service = new CommentService(
    repository as any,
    databaseService as any,
    ownerService as any,
    eventManager as any,
    readerService as any,
    fileReferenceService as any,
    commentCountryService as any,
    redisService,
  )
  return {
    commentCountryService,
    databaseService,
    eventManager,
    fileReferenceService,
    repository,
    redisClient,
    redisService,
    redisStore,
    service,
  }
}
