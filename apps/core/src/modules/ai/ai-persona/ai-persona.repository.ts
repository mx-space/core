import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { personaProfiles } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import type { EntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { PersonaProfile } from './ai-persona.types'

const mapRow = (row: typeof personaProfiles.$inferSelect): PersonaProfile => ({
  id: toEntityId(row.id) as EntityId,
  personaKey: row.personaKey,
  profile: row.profile,
  profileSummary: row.profileSummary ?? null,
  corpusVersion: row.corpusVersion,
  distillModel: row.distillModel,
  refreshedAt: row.refreshedAt,
  autoNextAt: row.autoNextAt ?? null,
  metadata: (row.metadata ?? {}) as Record<string, unknown>,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt ?? row.createdAt,
})

export interface UpsertPersonaProfileInput {
  personaKey: string
  profile: string
  profileSummary: string | null
  corpusVersion: number
  distillModel: string
  refreshedAt: Date
  metadata: Record<string, unknown>
}

@Injectable()
export class PersonaProfileRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByKey(personaKey: string): Promise<PersonaProfile | null> {
    const [row] = await this.db
      .select()
      .from(personaProfiles)
      .where(eq(personaProfiles.personaKey, personaKey))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async listKeysWithProfiles(): Promise<Set<string>> {
    const rows = await this.db
      .select({ personaKey: personaProfiles.personaKey })
      .from(personaProfiles)
    return new Set(rows.map((r) => r.personaKey))
  }

  async upsert(input: UpsertPersonaProfileInput): Promise<PersonaProfile> {
    const existing = await this.findByKey(input.personaKey)
    if (existing) {
      const [row] = await this.db
        .update(personaProfiles)
        .set({
          profile: input.profile,
          profileSummary: input.profileSummary,
          corpusVersion: input.corpusVersion,
          distillModel: input.distillModel,
          refreshedAt: input.refreshedAt,
          metadata: input.metadata,
          updatedAt: new Date(),
        })
        .where(eq(personaProfiles.personaKey, input.personaKey))
        .returning()
      return mapRow(row)
    }
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(personaProfiles)
      .values({
        id,
        personaKey: input.personaKey,
        profile: input.profile,
        profileSummary: input.profileSummary,
        corpusVersion: input.corpusVersion,
        distillModel: input.distillModel,
        refreshedAt: input.refreshedAt,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .returning()
    return mapRow(row)
  }

  async deleteByKey(personaKey: string): Promise<boolean> {
    const result = await this.db
      .delete(personaProfiles)
      .where(eq(personaProfiles.personaKey, personaKey))
      .returning({ id: personaProfiles.id })
    return result.length > 0
  }
}
