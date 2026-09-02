import { randomBytes } from 'node:crypto'

import type { OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { hashPassword } from 'better-auth/crypto'
import type pkg from 'pg'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { PG_POOL_TOKEN } from '~/constants/system.constant'
import {
  REVIEW_DEMO_SYNC_LOCK_KEY,
  withAdvisoryLock,
} from '~/processors/database/postgres.lock'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { CommentRepository } from '../comment/comment.repository'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { PollVoteRepository } from '../poll/poll-vote.repository'
import { ReaderRepository } from '../reader/reader.repository'
import { AuthRepository } from './auth.repository'
import type { CredentialSignInGate } from './email-sign-in-gate'
import {
  isReviewDemoEnabled,
  isReviewDemoProvisioned,
  REVIEW_DEMO_BAN_REASON,
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_HANDLE,
  REVIEW_DEMO_NAME,
  REVIEW_DEMO_SECRET_PASSWORD_KEY,
  REVIEW_DEMO_SECRET_READER_ID_KEY,
} from './review-demo.constants'

export type ReviewDemoCredentials =
  | { enabled: false }
  | { enabled: true; email: string; password: string }
  | { enabled: true; email: string; error: 'provision_failed' }

type ReviewDemoReader = {
  id: string
  email?: string | null
  emailVerified?: boolean | null
  handle?: string | null
  role?: string | null
  username?: string | null
}

const RESET_BATCH_SIZE = 50

@Injectable()
export class ReviewDemoService implements OnModuleInit {
  private readonly logger = new Logger(ReviewDemoService.name)
  private syncPromise?: Promise<void>
  private syncRerunRequested = false

  constructor(
    private readonly configsService: ConfigsService,
    private readonly readerRepository: ReaderRepository,
    private readonly authRepository: AuthRepository,
    private readonly snowflakeService: SnowflakeService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    private readonly commentRepository: CommentRepository,
    private readonly pollVoteRepository: PollVoteRepository,
    @Inject(PG_POOL_TOKEN) private readonly postgresPool: pkg.Pool,
  ) {}

  generatePassword() {
    return randomBytes(18).toString('base64url')
  }

  async onModuleInit() {
    await this.runQuietly('boot reconciliation', () => this.sync())
  }

  @OnEvent(EventBusEvents.ConfigChanged)
  async onConfigChanged() {
    await this.runQuietly('config change', () => this.sync())
  }

  private async runQuietly(reason: string, run: () => Promise<void>) {
    try {
      await run()
    } catch (error) {
      this.logger.error(
        `review demo sync failed (${reason}): ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  async waitForSync() {
    if (this.syncPromise) {
      await this.syncPromise
      return
    }
    await this.sync()
  }

  async getCredentialSignInGate(): Promise<CredentialSignInGate> {
    const [authSecurity, oauth] = await Promise.all([
      this.configsService.get('authSecurity'),
      this.configsService.get('oauth'),
    ])
    const reviewDemoEnabled = isReviewDemoEnabled(oauth)
    const reader = reviewDemoEnabled
      ? await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
      : null
    return {
      disablePasswordLogin: Boolean(authSecurity.disablePasswordLogin),
      reviewDemoEnabled,
      reviewDemoBanned: Boolean(reader?.bannedAt),
    }
  }

  async getCredentials(): Promise<ReviewDemoCredentials> {
    await this.runQuietly('credential read', () => this.waitForSync())
    const oauth = await this.configsService.get('oauth')
    if (!isReviewDemoEnabled(oauth)) {
      return { enabled: false }
    }
    const password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
    if (
      !password ||
      !reader ||
      !isReviewDemoProvisioned(reader) ||
      reader.bannedAt
    ) {
      return {
        enabled: true,
        email: REVIEW_DEMO_EMAIL,
        error: 'provision_failed',
      }
    }
    return { enabled: true, email: REVIEW_DEMO_EMAIL, password }
  }

  sync(): Promise<void> {
    if (this.syncPromise) {
      this.syncRerunRequested = true
      return this.syncPromise
    }
    this.syncPromise = this.runSyncLoop().finally(() => {
      this.syncPromise = undefined
    })
    return this.syncPromise
  }

  private async runSyncLoop() {
    let lastError: unknown
    do {
      this.syncRerunRequested = false
      try {
        await withAdvisoryLock(
          this.postgresPool,
          REVIEW_DEMO_SYNC_LOCK_KEY,
          () => this.syncUnlocked(),
        )
        lastError = undefined
      } catch (error) {
        lastError = error
      }
    } while (this.syncRerunRequested)
    if (lastError) {
      throw lastError
    }
  }

  private async syncUnlocked() {
    const oauth = await this.configsService.get('oauth')
    const enabled = isReviewDemoEnabled(oauth)
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)

    if (!enabled) {
      if (reader) {
        if (!reader.bannedAt) {
          await this.readerRepository.setBanned(reader.id, {
            bannedAt: new Date(),
            banReason: REVIEW_DEMO_BAN_REASON,
          })
        }
        await this.readerRepository.deleteSessionsForUser(reader.id)
      }
      return
    }

    const managedId = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_READER_ID_KEY]
    const conflict = await this.findConflict(reader, managedId)
    if (conflict) {
      this.logger.error(
        `review demo provisioning refused: ${conflict} is already taken by another account`,
      )
      return
    }

    const secretsPatch: Record<string, string> = {}
    let password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
    let generated = false
    if (!password) {
      password = this.generatePassword()
      generated = true
      secretsPatch[REVIEW_DEMO_SECRET_PASSWORD_KEY] = password
    }

    if (!reader) {
      const id = this.snowflakeService.nextId()
      secretsPatch[REVIEW_DEMO_SECRET_READER_ID_KEY] = id
      await this.configsService.patchAndValid('oauth', {
        secrets: { apple: secretsPatch },
      })
      await this.readerRepository.create({
        id,
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        name: REVIEW_DEMO_NAME,
        handle: REVIEW_DEMO_HANDLE,
        username: REVIEW_DEMO_HANDLE,
        displayUsername: REVIEW_DEMO_NAME,
        role: 'reader',
      })
      await this.authRepository.createAccount({
        id: this.snowflakeService.nextId(),
        providerAccountId: id,
        providerId: 'credential',
        userId: id,
        password: await hashPassword(password),
      })
      return
    }

    if (managedId !== reader.id) {
      secretsPatch[REVIEW_DEMO_SECRET_READER_ID_KEY] = reader.id
    }
    if (Object.keys(secretsPatch).length > 0) {
      await this.configsService.patchAndValid('oauth', {
        secrets: { apple: secretsPatch },
      })
    }

    const shouldUnban =
      Boolean(reader.bannedAt) && reader.banReason === REVIEW_DEMO_BAN_REASON
    if (shouldUnban) {
      await this.readerRepository.unsetBanned(reader.id)
    }
    const identityChanged =
      reader.email !== REVIEW_DEMO_EMAIL ||
      reader.emailVerified !== true ||
      reader.handle !== REVIEW_DEMO_HANDLE ||
      reader.username !== REVIEW_DEMO_HANDLE ||
      reader.role !== 'reader'
    if (identityChanged || shouldUnban) {
      await this.readerRepository.update(reader.id, {
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        handle: REVIEW_DEMO_HANDLE,
        role: 'reader',
        username: REVIEW_DEMO_HANDLE,
        ...(shouldUnban
          ? {
              displayUsername: REVIEW_DEMO_NAME,
              image: null,
              name: REVIEW_DEMO_NAME,
            }
          : {}),
      })
    }

    const accounts = await this.authRepository.findAccountsForUser(reader.id)
    const credential = accounts.find(
      (account) => account.providerId === 'credential',
    )
    if (!credential) {
      await this.authRepository.createAccount({
        id: this.snowflakeService.nextId(),
        providerAccountId: reader.id,
        providerId: 'credential',
        userId: reader.id,
        password: await hashPassword(password),
      })
      return
    }
    if (generated) {
      await this.authRepository.updateAccountPassword(
        credential.id,
        await hashPassword(password),
      )
    }
  }

  private async findConflict(
    reader: ReviewDemoReader | null,
    managedId?: string,
  ): Promise<'email' | 'username' | null> {
    // A row the service never provisioned may legitimately belong to a real
    // person; rewriting its identity would demote and lock out that account.
    // Rows provisioned before the id was recorded are adopted by their shape.
    if (reader) {
      const managed = managedId
        ? reader.id === managedId
        : isReviewDemoProvisioned(reader)
      if (!managed) return 'email'
    }
    const usernameHolder =
      await this.readerRepository.findByUsername(REVIEW_DEMO_HANDLE)
    if (usernameHolder && usernameHolder.id !== reader?.id) return 'username'
    return null
  }

  async resetDaily(): Promise<
    { skipped: true } | { comments: number; pollVotes: number }
  > {
    const oauth = await this.configsService.get('oauth')
    if (!isReviewDemoEnabled(oauth)) {
      return { skipped: true }
    }
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
    if (!reader) {
      return { skipped: true }
    }
    let comments = 0
    let previousBatchHead: string | undefined
    for (;;) {
      const batch = await this.commentRepository.paginatedFind(
        { readerId: reader.id, isDeleted: false },
        1,
        RESET_BATCH_SIZE,
      )
      const rows = batch.data
      if (rows.length === 0) break
      const head = String(rows[0].id)
      if (head === previousBatchHead) {
        this.logger.warn(
          `review demo reset stalled on comment ${head}, aborting sweep`,
        )
        break
      }
      previousBatchHead = head
      for (const comment of rows) {
        await this.commentService.softDeleteComment(String(comment.id))
      }
      comments += rows.length
      if (rows.length < RESET_BATCH_SIZE) break
    }
    const [pollVotes] = await Promise.all([
      this.pollVoteRepository.deleteByFingerprint(`r:${reader.id}`),
      this.commentRepository.clearBlockedReaders(reader.id),
    ])
    await this.readerRepository.update(reader.id, {
      name: REVIEW_DEMO_NAME,
      displayUsername: REVIEW_DEMO_NAME,
      image: null,
    })
    return { comments, pollVotes }
  }
}
