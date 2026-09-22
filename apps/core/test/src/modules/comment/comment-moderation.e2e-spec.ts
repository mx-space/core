import { existsSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createCommentServiceFixture } from 'test/helper/comment-service-fixture'
import {
  createPgTestDatabase,
  type PgTestDatabase,
} from 'test/helper/pg-verify-url'
import { setupE2EApp } from 'test/helper/setup-e2e'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppExceptionFilter } from '~/common/filters/app-exception.filter'
import { AuthGuard } from '~/common/guards/auth.guard'
import { ResponseInterceptor } from '~/common/interceptors/response.interceptor'
import { AuthService } from '~/modules/auth/auth.service'
import { CommentController } from '~/modules/comment/comment.controller'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { CommentService } from '~/modules/comment/comment.service'
import { CommentSpamFilterService } from '~/modules/comment/comment.spam-filter'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

// Real HTTP, schema/envelope, service, moderation lifecycle and PostgreSQL;
// only external model, queue transport and notification transports are doubles.
describe('comment moderation HTTP lifecycle', () => {
  let app: NestFastifyApplication
  let db: PgTestDatabase
  let repository: CommentRepository
  let lifecycle: CommentLifecycleService
  const snowflake = new SnowflakeService()
  const refId = snowflake.nextId()
  const options = {
    antiSpam: true,
    aiReview: true,
    decisionReview: true,
    decisionConfidence: 0.9,
    decisionTimeoutMs: 1000,
    aiReviewType: 'binary',
    aiReviewThreshold: 5,
    allowGuestComment: true,
    commentShouldAudit: false,
  }
  const decide = vi.fn()
  const llm = vi.fn()
  const enqueue = vi.fn().mockResolvedValue({ created: true, taskId: 'task' })
  const configs = {
    get: async (key: string) => (key === 'commentOptions' ? options : {}),
  }
  const answer = (confidence: number, spam = false) => ({
    risk: { type: 'choice', choice: spam ? 'spam' : 'safe', confidence },
    sensitive: { type: 'choice', choice: 'safe', confidence },
  })

  beforeAll(async () => {
    db = await createPgTestDatabase('mx_comment_http')
    repository = new CommentRepository(db.db as any, snowflake)
    const fixture = createCommentServiceFixture()
    const owner = {
      getOwner: async () => ({ name: 'Owner', username: 'owner' }),
      isOwnerName: async () => false,
    }
    const spam = new CommentSpamFilterService(
      configs as any,
      owner as any,
      {
        decide,
        getCommentReviewModel: async () => ({ generateStructured: llm }),
      } as any,
    )
    const service = fixture.service
    Object.assign(service, {
      commentRepository: repository,
      spamFilterService: spam,
      configsService: configs,
    })
    lifecycle = new CommentLifecycleService(
      service,
      fixture.databaseService as any,
      configs as any,
      owner as any,
      {} as any,
      {} as any,
      spam,
      {} as any,
      fixture.eventManager as any,
      {} as any,
      fixture.fileReferenceService as any,
      repository,
      { createTask: enqueue } as any,
      {} as any,
    )
    const lifecycleFacade = {
      afterCreateComment: lifecycle.afterCreateComment.bind(lifecycle),
      afterReplyComment: lifecycle.afterReplyComment.bind(lifecycle),
    }
    app = await setupE2EApp({
      controllers: [CommentController],
      providers: [
        { provide: CommentService, useValue: service },
        { provide: CommentLifecycleService, useValue: lifecycleFacade },
        { provide: ConfigsService, useValue: configs },
        {
          provide: ReaderService,
          useValue: { findReaderInIds: async () => [] },
        },
        { provide: EventManagerService, useValue: fixture.eventManager },
        {
          provide: EntitlementService,
          useValue: { getActiveMemberIds: async () => new Set() },
        },
        { provide: AuthGuard, useValue: { canActivate: () => true } },
        {
          provide: AuthService,
          useValue: { getSessionUser: async () => null },
        },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
        { provide: APP_FILTER, useClass: AppExceptionFilter },
      ],
    })
  }, 60000)
  afterAll(async () => {
    await app?.close()
    await db?.close()
  })
  const submit = async (replyTo?: string) =>
    app.inject({
      method: 'POST',
      url: replyTo
        ? `/comments/guest/reply/${replyTo}`
        : `/comments/guest/${refId}`,
      payload: {
        author: 'Alice',
        mail: 'alice@example.com',
        text: '谢谢分享，这篇文章详细解释了问题。',
      },
    })
  const status = async (id: string, receipt: string) =>
    app.inject({
      method: 'POST',
      url: `/comments/${id}/moderation`,
      payload: { receipt },
    })

  it.skipIf(!process.env.JEV_BROWSER_PORT)(
    'serves the real moderation HTTP flow for browser verification',
    async () => {
      options.commentShouldAudit = false
      decide.mockResolvedValue(answer(0.3))
      llm.mockResolvedValue({
        output: { isSpam: false, hasSensitiveContent: false },
      })
      enqueue.mockImplementation(async ({ payload }) => {
        setTimeout(
          () => void (lifecycle as any).reviewComment(payload.commentId),
          8000,
        )
        return { created: true, taskId: 'browser-task' }
      })
      const server = createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Headers', 'content-type')
        if (req.method === 'OPTIONS') {
          res.end()
          return
        }
        if (req.url === '/ref') {
          res.end(JSON.stringify({ refId }))
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const response = await app.inject({
          method: req.method as any,
          url: req.url!,
          ...(chunks.length
            ? {
                payload: Buffer.concat(chunks),
                headers: { 'content-type': 'application/json' },
              }
            : {}),
        })
        res.statusCode = response.statusCode
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(response.body)
      })
      await new Promise<void>((resolve) =>
        server.listen(
          Number(process.env.JEV_BROWSER_PORT),
          '127.0.0.1',
          resolve,
        ),
      )
      writeFileSync('/tmp/mx-jev-browser-ready', 'ready')
      try {
        for (let i = 0; i < 480 && !existsSync('/tmp/mx-jev-browser-done'); i++)
          await new Promise((resolve) => setTimeout(resolve, 500))
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    },
    250000,
  )

  it('returns immediate decisions and hides unresolved comments until successful background review', async () => {
    decide.mockResolvedValue(answer(1))
    const safeResponse = await submit()
    expect(safeResponse.statusCode, safeResponse.body).toBe(201)
    const safe = safeResponse.json().data
    expect(safe.moderation.status).toBe('published')
    decide.mockResolvedValue(answer(0.3))
    const replyResponse = await submit(safe.id)
    expect(replyResponse.statusCode, replyResponse.body).toBe(201)
    const pending = replyResponse.json().data
    expect(pending.moderation.status).toBe('pending')
    expect(
      (await app.inject({ method: 'GET', url: `/comments/${pending.id}` }))
        .statusCode,
    ).toBe(404)
    expect((await status(pending.id, 'f'.repeat(64))).statusCode).toBe(404)
    const receiptResponse = await status(pending.id, pending.moderation.receipt)
    expect(receiptResponse.headers['cache-control']).toBe('no-store')
    expect(receiptResponse.json().data).toEqual({ status: 'pending' })
    llm.mockResolvedValue({
      output: { isSpam: false, hasSensitiveContent: false },
    })
    await (lifecycle as any).reviewComment(pending.id)
    expect(
      (await status(pending.id, pending.moderation.receipt)).json().data,
    ).toEqual({ status: 'published' })
    expect((await repository.findById(pending.id))?.state).toBe(0)
    expect(
      (await app.inject({ method: 'GET', url: `/comments/${pending.id}` }))
        .statusCode,
    ).toBe(200)
    decide.mockResolvedValue(answer(1, true))
    expect((await submit()).json().data.moderation.status).toBe('rejected')
  })

  it('recovers missed jobs, stops failed reviews at manual intervention, and keeps human approval mandatory', async () => {
    decide.mockRejectedValue(new Error('timeout'))
    const pending = (await submit()).json().data
    enqueue.mockClear()
    await lifecycle.recoverPendingReviews()
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { commentId: pending.id } }),
    )
    llm.mockRejectedValue(new Error('upstream failure'))
    await expect((lifecycle as any).reviewComment(pending.id)).rejects.toThrow()
    await expect((lifecycle as any).reviewComment(pending.id)).rejects.toThrow()
    await (lifecycle as any).reviewComment(pending.id)
    expect((await repository.findById(pending.id))?.moderationStatus).toBe(
      'manual',
    )
    expect(
      (await status(pending.id, pending.moderation.receipt)).json().data.status,
    ).toBe('pending')
    options.commentShouldAudit = true
    decide.mockResolvedValue(answer(1))
    const humanReview = (await submit()).json().data
    expect(humanReview.moderation.status).toBe('pending')
    await repository.updateStateBulk([humanReview.id], 1)
    expect(
      (await status(humanReview.id, humanReview.moderation.receipt)).json().data
        .status,
    ).toBe('published')
    expect((await status(humanReview.id, 'invalid')).statusCode).toBe(422)
  })
})
