import { randomBytes } from 'node:crypto'

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { hashPassword } from 'better-auth/crypto'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import { CommentRepository } from '../comment/comment.repository'
import { CommentService } from '../comment/comment.service'
import { ConfigsService } from '../configs/configs.service'
import { PollVoteRepository } from '../poll/poll-vote.repository'
import { ReaderRepository } from '../reader/reader.repository'
import { AuthRepository } from './auth.repository'
import type { EmailSignInGate } from './email-sign-in-gate'
import {
  isReviewDemoEnabled,
  isReviewDemoIdentity,
  REVIEW_DEMO_BAN_REASON,
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_HANDLE,
  REVIEW_DEMO_NAME,
  REVIEW_DEMO_SECRET_PASSWORD_KEY,
} from './review-demo.constants'

export type ReviewDemoCredentials =
  | { enabled: false }
  | { enabled: true; email: string; password: string }
  | { enabled: true; email: string; error: 'provision_failed' }

@Injectable()
export class ReviewDemoService {
  private readonly logger = new Logger(ReviewDemoService.name)
  private syncing = false
  private readonly syncWaiters: Array<() => void> = []

  constructor(
    private readonly configsService: ConfigsService,
    private readonly readerRepository: ReaderRepository,
    private readonly authRepository: AuthRepository,
    private readonly snowflakeService: SnowflakeService,
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    private readonly commentRepository: CommentRepository,
    private readonly pollVoteRepository: PollVoteRepository,
  ) {}

  generatePassword() {
    return randomBytes(18).toString('base64url')
  }

  @OnEvent(EventBusEvents.ConfigChanged)
  async onConfigChanged() {
    await this.sync()
  }

  async waitForSync() {
    if (this.syncing) {
      await new Promise<void>((resolve) => this.syncWaiters.push(resolve))
      return
    }
    await this.sync()
  }

  async getEmailSignInGate(): Promise<EmailSignInGate> {
    await this.waitForSync()
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
    await this.waitForSync()
    const oauth = await this.configsService.get('oauth')
    if (!isReviewDemoEnabled(oauth)) {
      return { enabled: false }
    }
    const password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
    if (
      !password ||
      !reader ||
      !isReviewDemoIdentity(reader) ||
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

  async sync() {
    if (this.syncing) return
    this.syncing = true
    try {
      await this.syncUnlocked()
    } finally {
      this.syncing = false
      const waiters = this.syncWaiters.splice(0)
      for (const waiter of waiters) waiter()
    }
  }

  private async syncUnlocked() {
    const oauth = await this.configsService.get('oauth')
    const enabled = isReviewDemoEnabled(oauth)
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)

    if (!enabled) {
      if (reader && isReviewDemoIdentity(reader)) {
        await this.readerRepository.setBanned(reader.id, {
          bannedAt: new Date(),
          banReason: REVIEW_DEMO_BAN_REASON,
        })
        await this.readerRepository.deleteSessionsForUser(reader.id)
      }
      return
    }

    if (reader && !isReviewDemoIdentity(reader)) {
      this.logger.error('review demo email is occupied by a non-demo reader')
      return
    }

    let password = oauth.secrets?.apple?.[REVIEW_DEMO_SECRET_PASSWORD_KEY]
    let generated = false
    if (!password) {
      password = this.generatePassword()
      generated = true
      await this.configsService.patchAndValid('oauth', {
        secrets: { apple: { [REVIEW_DEMO_SECRET_PASSWORD_KEY]: password } },
      })
    }

    if (!reader) {
      const id = this.snowflakeService.nextId()
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

    if (reader.bannedAt) {
      await this.readerRepository.unsetBanned(reader.id)
      await this.readerRepository.update(reader.id, {
        name: REVIEW_DEMO_NAME,
        displayUsername: REVIEW_DEMO_NAME,
        image: null,
      })
    }

    const accounts = await this.authRepository.findAccountsForUser(reader.id)
    const credential = accounts.find(
      (account) => account.providerId === 'credential',
    )
    const passwordHash = await hashPassword(password)
    if (!credential) {
      await this.authRepository.createAccount({
        id: this.snowflakeService.nextId(),
        providerAccountId: reader.id,
        providerId: 'credential',
        userId: reader.id,
        password: passwordHash,
      })
      return
    }
    if (generated) {
      await this.authRepository.updateAccountPassword(
        credential.id,
        passwordHash,
      )
    }
  }

  async resetDaily(): Promise<
    { skipped: true } | { comments: number; pollVotes: number }
  > {
    const oauth = await this.configsService.get('oauth')
    if (!isReviewDemoEnabled(oauth)) {
      return { skipped: true }
    }
    const reader = await this.readerRepository.findByEmail(REVIEW_DEMO_EMAIL)
    if (!reader || !isReviewDemoIdentity(reader)) {
      return { skipped: true }
    }
    const comments = await this.commentRepository.findByFilter({
      readerId: reader.id,
      isDeleted: false,
    })
    for (const comment of comments) {
      await this.commentService.softDeleteComment(String(comment.id))
    }
    const pollVotes = await this.pollVoteRepository.deleteByFingerprint(
      `r:${reader.id}`,
    )
    await this.readerRepository.update(reader.id, {
      name: REVIEW_DEMO_NAME,
      displayUsername: REVIEW_DEMO_NAME,
      image: null,
    })
    return { comments: comments.length, pollVotes }
  }
}
