import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { pollVoteOptions, pollVotes } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface PollVoteRow {
  id: EntityId
  pollId: string
  voterFingerprint: string
  optionIds: string[]
  createdAt: Date
}

@Injectable()
export class PollVoteRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async hasVoted(pollId: string, fingerprint: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: pollVotes.id })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.voterFingerprint, fingerprint),
        )!,
      )
      .limit(1)
    return Boolean(row)
  }

  async castVote(input: {
    pollId: string
    voterFingerprint: string
    optionIds: string[]
  }): Promise<PollVoteRow> {
    const id = this.snowflake.nextBigInt()
    return this.db.transaction(async (tx) => {
      const [vote] = await tx
        .insert(pollVotes)
        .values({
          id,
          pollId: input.pollId,
          voterFingerprint: input.voterFingerprint,
        })
        .returning()
      if (input.optionIds.length > 0) {
        await tx.insert(pollVoteOptions).values(
          input.optionIds.map((optionId) => ({
            voteId: id,
            optionId,
          })),
        )
      }
      return {
        id: toEntityId(vote.id) as EntityId,
        pollId: vote.pollId,
        voterFingerprint: vote.voterFingerprint,
        optionIds: input.optionIds,
        createdAt: vote.createdAt,
      }
    })
  }

  async tally(
    pollId: string,
  ): Promise<Array<{ optionId: string; count: number }>> {
    const rows = await this.db
      .select({
        optionId: pollVoteOptions.optionId,
        count: sql<number>`count(*)::int`,
      })
      .from(pollVoteOptions)
      .innerJoin(pollVotes, eq(pollVotes.id, pollVoteOptions.voteId))
      .where(eq(pollVotes.pollId, pollId))
      .groupBy(pollVoteOptions.optionId)
      .orderBy(sql`count(*) desc`)
    return rows.map((r) => ({
      optionId: r.optionId,
      count: Number(r.count ?? 0),
    }))
  }

  async countForPoll(pollId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, pollId))
    return Number(row?.count ?? 0)
  }

  async listOptionsForVote(voteId: EntityId | string): Promise<string[]> {
    const idBig = parseEntityId(voteId)
    const rows = await this.db
      .select({ optionId: pollVoteOptions.optionId })
      .from(pollVoteOptions)
      .where(eq(pollVoteOptions.voteId, idBig))
    return rows.map((r) => r.optionId)
  }
}
