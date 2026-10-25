import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  contentCollabInvites,
  contentCollaborators,
  contentDocuments,
  readers,
} from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface CollabInviteRow {
  createdAt: Date
  documentId: EntityId
  expiresAt: Date
  id: EntityId
  maxUses: number | null
  tokenHash: string
  uses: number
}

export interface CollaboratorRow {
  avatar: string | null
  contributedAt: Date | null
  createdAt: Date
  name: string
  readerId: string
  removedAt: Date | null
  showInByline: boolean
}

export interface CoAuthor {
  avatar: string | null
  name: string
}

export type AcceptInviteResult =
  | { documentId: EntityId; ok: true }
  | { ok: false; reason: 'exhausted' | 'expired' | 'not_found' | 'revoked' }

const mapInvite = (
  row: typeof contentCollabInvites.$inferSelect,
): CollabInviteRow => ({
  createdAt: row.createdAt,
  documentId: toEntityId(row.documentId)!,
  expiresAt: row.expiresAt,
  id: toEntityId(row.id)!,
  maxUses: row.maxUses,
  tokenHash: row.tokenHash,
  uses: row.uses,
})

const usableInvite = (
  invite: typeof contentCollabInvites.$inferSelect | undefined,
): AcceptInviteResult => {
  if (!invite) return { ok: false, reason: 'not_found' }
  if (invite.revokedAt) return { ok: false, reason: 'revoked' }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return { documentId: toEntityId(invite.documentId)!, ok: true }
}

const displayName = sql<string>`coalesce(${readers.name}, ${readers.displayUsername}, ${readers.username}, '')`

@Injectable()
export class CollabRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async createInvite(input: {
    documentId: EntityId | string
    expiresAt: Date
    maxUses: number | null
    tokenHash: string
  }): Promise<CollabInviteRow> {
    const [row] = await this.db
      .insert(contentCollabInvites)
      .values({
        documentId: parseEntityId(input.documentId),
        expiresAt: input.expiresAt,
        id: this.snowflake.nextId(),
        maxUses: input.maxUses,
        tokenHash: input.tokenHash,
      })
      .returning()
    return mapInvite(row)
  }

  async listInvites(documentId: EntityId | string): Promise<CollabInviteRow[]> {
    const rows = await this.db
      .select()
      .from(contentCollabInvites)
      .where(
        and(
          eq(contentCollabInvites.documentId, parseEntityId(documentId)),
          isNull(contentCollabInvites.revokedAt),
          gt(contentCollabInvites.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(contentCollabInvites.createdAt))
    return rows
      .filter((row) => row.maxUses === null || row.uses < row.maxUses)
      .map(mapInvite)
  }

  async revokeInvite(
    documentId: EntityId | string,
    inviteId: EntityId | string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(contentCollabInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(contentCollabInvites.id, parseEntityId(inviteId)),
          eq(contentCollabInvites.documentId, parseEntityId(documentId)),
          isNull(contentCollabInvites.revokedAt),
        ),
      )
      .returning({ id: contentCollabInvites.id })
    return rows.length > 0
  }

  async acceptInvite(
    tokenHash: string,
    readerId: string,
  ): Promise<AcceptInviteResult> {
    return this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(contentCollabInvites)
        .where(eq(contentCollabInvites.tokenHash, tokenHash))
        .for('update')
        .limit(1)
      const usable = usableInvite(invite)
      if (!usable.ok || !invite) return usable
      const { documentId } = usable
      const [existing] = await tx
        .select({
          id: contentCollaborators.id,
          removedAt: contentCollaborators.removedAt,
        })
        .from(contentCollaborators)
        .where(
          and(
            eq(contentCollaborators.documentId, invite.documentId),
            eq(contentCollaborators.readerId, readerId),
          ),
        )
        .limit(1)
      if (existing && !existing.removedAt) return { documentId, ok: true }
      // A link made before the removal must not undo it; only a later invite brings them back.
      if (existing?.removedAt && invite.createdAt <= existing.removedAt) {
        return { ok: false, reason: 'revoked' }
      }
      if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
        return { ok: false, reason: 'exhausted' }
      }
      if (existing) {
        await tx
          .update(contentCollaborators)
          .set({ removedAt: null })
          .where(eq(contentCollaborators.id, existing.id))
      } else {
        await tx.insert(contentCollaborators).values({
          documentId: invite.documentId,
          id: this.snowflake.nextId(),
          readerId,
        })
      }
      await tx
        .update(contentCollabInvites)
        .set({ uses: invite.uses + 1 })
        .where(eq(contentCollabInvites.id, invite.id))
      return { documentId, ok: true }
    })
  }

  async peekInvite(tokenHash: string): Promise<AcceptInviteResult> {
    const [invite] = await this.db
      .select()
      .from(contentCollabInvites)
      .where(eq(contentCollabInvites.tokenHash, tokenHash))
      .limit(1)
    const usable = usableInvite(invite)
    if (!usable.ok || !invite) return usable
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return { ok: false, reason: 'exhausted' }
    }
    return usable
  }

  async addCollaborator(
    documentId: EntityId | string,
    readerId: string,
  ): Promise<void> {
    await this.db
      .insert(contentCollaborators)
      .values({
        documentId: parseEntityId(documentId),
        id: this.snowflake.nextId(),
        readerId,
      })
      .onConflictDoNothing()
  }

  async isCollaborator(
    documentId: EntityId | string,
    readerId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: contentCollaborators.id })
      .from(contentCollaborators)
      .where(this.member(documentId, readerId))
      .limit(1)
    return Boolean(row)
  }

  async listCollaborators(
    documentId: EntityId | string,
  ): Promise<CollaboratorRow[]> {
    return this.db
      .select({
        avatar: readers.image,
        contributedAt: contentCollaborators.contributedAt,
        createdAt: contentCollaborators.createdAt,
        name: displayName,
        readerId: contentCollaborators.readerId,
        removedAt: contentCollaborators.removedAt,
        showInByline: contentCollaborators.showInByline,
      })
      .from(contentCollaborators)
      .innerJoin(readers, eq(readers.id, contentCollaborators.readerId))
      .where(eq(contentCollaborators.documentId, parseEntityId(documentId)))
      .orderBy(
        asc(contentCollaborators.createdAt),
        asc(contentCollaborators.id),
      )
  }

  async removeCollaborator(
    documentId: EntityId | string,
    readerId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(contentCollaborators)
      .set({ removedAt: sql`now()` })
      .where(this.member(documentId, readerId))
      .returning({ id: contentCollaborators.id })
    return rows.length > 0
  }

  async setShowInByline(
    documentId: EntityId | string,
    readerId: string,
    showInByline: boolean,
  ): Promise<boolean> {
    const rows = await this.db
      .update(contentCollaborators)
      .set({ showInByline })
      .where(this.member(documentId, readerId))
      .returning({ id: contentCollaborators.id })
    return rows.length > 0
  }

  async markContributed(
    documentId: EntityId | string,
    readerId: string,
  ): Promise<void> {
    await this.db
      .update(contentCollaborators)
      .set({ contributedAt: sql`now()` })
      .where(
        and(
          this.member(documentId, readerId),
          isNull(contentCollaborators.contributedAt),
        ),
      )
  }

  async coAuthorsByRef(
    refType: string,
    refIds: Array<EntityId | string>,
  ): Promise<Map<string, CoAuthor[]>> {
    const result = new Map<string, CoAuthor[]>()
    if (!refIds.length) return result
    const rows = await this.db
      .select({
        avatar: readers.image,
        name: displayName,
        refId: contentDocuments.refId,
      })
      .from(contentCollaborators)
      .innerJoin(
        contentDocuments,
        eq(contentDocuments.id, contentCollaborators.documentId),
      )
      .innerJoin(readers, eq(readers.id, contentCollaborators.readerId))
      .where(
        and(
          eq(contentDocuments.refType, refType),
          inArray(
            contentDocuments.refId,
            refIds.map((id) => parseEntityId(id)),
          ),
          isNotNull(contentCollaborators.contributedAt),
          isNull(contentCollaborators.removedAt),
          eq(contentCollaborators.showInByline, true),
        ),
      )
      .orderBy(
        asc(contentCollaborators.contributedAt),
        asc(contentCollaborators.id),
      )
    for (const { refId, ...author } of rows) {
      const key = String(toEntityId(refId))
      const list = result.get(key) ?? []
      list.push(author)
      result.set(key, list)
    }
    return result
  }

  async presenceUserOf(readerId: string): Promise<{
    avatar: string | null
    id: string
    name: string
    role: string
  } | null> {
    const [row] = await this.db
      .select({
        avatar: readers.image,
        id: readers.id,
        name: displayName,
        role: readers.role,
      })
      .from(readers)
      .where(eq(readers.id, readerId))
      .limit(1)
    return row ?? null
  }

  async ownerId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: readers.id })
      .from(readers)
      .where(eq(readers.role, 'owner'))
      .orderBy(asc(readers.createdAt), asc(readers.id))
      .limit(1)
    return row?.id ?? null
  }

  private member(documentId: EntityId | string, readerId: string) {
    return and(
      eq(contentCollaborators.documentId, parseEntityId(documentId)),
      eq(contentCollaborators.readerId, readerId),
      isNull(contentCollaborators.removedAt),
    )
  }
}
