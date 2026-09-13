import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { articlePurchases } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { EntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  ArticlePurchaseRow,
  ArticlePurchaseStatus,
} from './membership.types'

const mapRow = (
  row: typeof articlePurchases.$inferSelect,
): ArticlePurchaseRow => ({
  id: toEntityId(row.id) as EntityId,
  readerId: row.readerId,
  postId: row.postId,
  provider: row.provider,
  providerPaymentId: row.providerPaymentId,
  providerCustomerId: row.providerCustomerId,
  amount: row.amount,
  currency: row.currency,
  status: row.status as ArticlePurchaseStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

@Injectable()
export class ArticlePurchaseRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByReaderAndPost(
    readerId: string,
    postId: string,
  ): Promise<ArticlePurchaseRow | null> {
    const [row] = await this.db
      .select()
      .from(articlePurchases)
      .where(
        and(
          eq(articlePurchases.readerId, readerId),
          eq(articlePurchases.postId, postId),
        )!,
      )
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findPaidPostIds(
    readerId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (postIds.length === 0) return new Set()
    const rows = await this.db
      .select({ postId: articlePurchases.postId })
      .from(articlePurchases)
      .where(
        and(
          eq(articlePurchases.readerId, readerId),
          eq(articlePurchases.status, 'paid'),
          inArray(articlePurchases.postId, postIds),
        )!,
      )
    return new Set(rows.map((row) => row.postId))
  }

  async upsertPaid(input: {
    readerId: string
    postId: string
    provider: string
    providerPaymentId: string
    providerCustomerId?: string | null
    amount: number
    currency: string
  }): Promise<ArticlePurchaseRow> {
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(articlePurchases)
      .values({
        id,
        readerId: input.readerId,
        postId: input.postId,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        providerCustomerId: input.providerCustomerId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: 'paid',
      })
      .onConflictDoUpdate({
        target: [articlePurchases.readerId, articlePurchases.postId],
        set: {
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          providerCustomerId: input.providerCustomerId ?? null,
          amount: input.amount,
          currency: input.currency,
          status: 'paid',
          updatedAt: new Date(),
        },
      })
      .returning()
    return mapRow(row)
  }

  async markRefunded(
    provider: string,
    providerPaymentId: string,
  ): Promise<ArticlePurchaseRow | null> {
    const [row] = await this.db
      .update(articlePurchases)
      .set({ status: 'refunded', updatedAt: new Date() })
      .where(
        and(
          eq(articlePurchases.provider, provider),
          eq(articlePurchases.providerPaymentId, providerPaymentId),
        )!,
      )
      .returning()
    return row ? mapRow(row) : null
  }
}
