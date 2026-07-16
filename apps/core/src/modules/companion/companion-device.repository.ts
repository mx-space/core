import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  companionDevices,
  type CompanionDeviceScope,
  companionPairings,
} from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export type CompanionDeviceRecord = typeof companionDevices.$inferSelect
export type CompanionPairingRecord = typeof companionPairings.$inferSelect

@Injectable()
export class CompanionDeviceRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async createPairing(input: {
    id: string
    ownerId: string
    codeHash: string
    scopes: CompanionDeviceScope[]
    expiresAt: Date
  }): Promise<CompanionPairingRecord> {
    const [row] = await this.db
      .insert(companionPairings)
      .values(input)
      .returning()
    return row
  }

  async claimPairing(input: {
    codeHash: string
    claimedAt: Date
    device: {
      id: string
      name: string
      tokenHash: string
    }
  }): Promise<{
    pairing: CompanionPairingRecord
    device: CompanionDeviceRecord
  } | null> {
    return this.db.transaction(async (tx) => {
      const [pairing] = await tx
        .update(companionPairings)
        .set({ claimedAt: input.claimedAt, updatedAt: input.claimedAt })
        .where(
          and(
            eq(companionPairings.codeHash, input.codeHash),
            isNull(companionPairings.claimedAt),
            gt(companionPairings.expiresAt, input.claimedAt),
          )!,
        )
        .returning()

      if (!pairing) return null

      const [device] = await tx
        .insert(companionDevices)
        .values({
          ...input.device,
          ownerId: pairing.ownerId,
          scopes: pairing.scopes,
        })
        .returning()

      return { pairing, device }
    })
  }

  async findDeviceById(id: string): Promise<CompanionDeviceRecord | null> {
    const [row] = await this.db
      .select()
      .from(companionDevices)
      .where(eq(companionDevices.id, id))
      .limit(1)
    return row ?? null
  }

  async listDevices(ownerId: string): Promise<CompanionDeviceRecord[]> {
    return this.db
      .select()
      .from(companionDevices)
      .where(eq(companionDevices.ownerId, ownerId))
      .orderBy(desc(companionDevices.createdAt))
  }

  async markLastSeen(
    id: string,
    seenAt: Date,
    writeIntervalMs: number,
  ): Promise<void> {
    const threshold = new Date(seenAt.getTime() - writeIntervalMs)
    await this.db
      .update(companionDevices)
      .set({ lastSeenAt: seenAt, updatedAt: seenAt })
      .where(
        and(
          eq(companionDevices.id, id),
          isNull(companionDevices.revokedAt),
          or(
            isNull(companionDevices.lastSeenAt),
            lt(companionDevices.lastSeenAt, threshold),
          )!,
        )!,
      )
  }

  async revokeDevice(
    ownerId: string,
    id: string,
    revokedAt: Date,
  ): Promise<CompanionDeviceRecord | null> {
    const [row] = await this.db
      .update(companionDevices)
      .set({
        // Keep the first revocation timestamp while allowing an idempotent
        // retry to invoke the projection-removal port after a prior failure.
        revokedAt: sql<Date>`coalesce(${companionDevices.revokedAt}, ${revokedAt})`,
      })
      .where(
        and(
          eq(companionDevices.ownerId, ownerId),
          eq(companionDevices.id, id),
        )!,
      )
      .returning()
    return row ?? null
  }

  async listDevicesPendingPresenceClear(
    limit = 100,
  ): Promise<CompanionDeviceRecord[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 500))

    return this.db
      .select()
      .from(companionDevices)
      .where(
        and(
          isNotNull(companionDevices.revokedAt),
          isNull(companionDevices.presenceClearedAt),
        )!,
      )
      .orderBy(asc(companionDevices.revokedAt))
      .limit(boundedLimit)
  }

  async markPresenceCleared(
    id: string,
    clearedAt: Date,
  ): Promise<CompanionDeviceRecord | null> {
    const [row] = await this.db
      .update(companionDevices)
      .set({ presenceClearedAt: clearedAt, updatedAt: clearedAt })
      .where(
        and(
          eq(companionDevices.id, id),
          isNotNull(companionDevices.revokedAt),
          isNull(companionDevices.presenceClearedAt),
        )!,
      )
      .returning()

    return row ?? null
  }
}
