import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { ownerProfiles } from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export interface OwnerProfileRow {
  id: string
  readerId: string
  mail: string | null
  url: string | null
  introduce: string | null
  lastLoginIp: string | null
  lastLoginTime: Date | null
  socialIds: Record<string, unknown> | null
  createdAt: Date
}

const mapRow = (row: typeof ownerProfiles.$inferSelect): OwnerProfileRow => ({
  id: row.id,
  readerId: row.readerId,
  mail: row.mail,
  url: row.url,
  introduce: row.introduce,
  lastLoginIp: row.lastLoginIp,
  lastLoginTime: row.lastLoginTime,
  socialIds: row.socialIds,
  createdAt: row.createdAt,
})

@Injectable()
export class OwnerRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findByReaderId(readerId: string): Promise<OwnerProfileRow | null> {
    const [row] = await this.db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.readerId, readerId))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async upsertByReaderId(
    readerId: string,
    patch: Partial<{
      id: string
      mail: string | null
      url: string | null
      introduce: string | null
      lastLoginIp: string | null
      lastLoginTime: Date | null
      socialIds: Record<string, unknown> | null
    }>,
  ): Promise<OwnerProfileRow> {
    const [row] = await this.db
      .insert(ownerProfiles)
      .values({
        id: patch.id ?? readerId,
        readerId,
        mail: patch.mail ?? null,
        url: patch.url ?? null,
        introduce: patch.introduce ?? null,
        lastLoginIp: patch.lastLoginIp ?? null,
        lastLoginTime: patch.lastLoginTime ?? null,
        socialIds: patch.socialIds ?? null,
      })
      .onConflictDoUpdate({
        target: ownerProfiles.readerId,
        set: {
          ...(patch.mail !== undefined ? { mail: patch.mail } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.introduce !== undefined
            ? { introduce: patch.introduce }
            : {}),
          ...(patch.lastLoginIp !== undefined
            ? { lastLoginIp: patch.lastLoginIp }
            : {}),
          ...(patch.lastLoginTime !== undefined
            ? { lastLoginTime: patch.lastLoginTime }
            : {}),
          ...(patch.socialIds !== undefined
            ? { socialIds: patch.socialIds }
            : {}),
        },
      })
      .returning()
    return mapRow(row)
  }
}
