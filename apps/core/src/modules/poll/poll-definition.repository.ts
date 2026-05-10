import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { SQL, SQLWrapper } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { notes, pages, posts } from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type { PollContentCandidate, PollDefinition } from './poll-definition.types'
import { extractPollDefinitions } from './poll-definition.util'

@Injectable()
export class PollDefinitionRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findByPollId(pollId: string): Promise<PollDefinition | null> {
    const candidates = await this.findVisibleContentCandidates([pollId])

    for (const candidate of candidates) {
      const definition = extractPollDefinitions(candidate).find(
        (poll) => poll.pollId === pollId,
      )
      if (definition) return definition
    }

    return null
  }

  private buildPollIdPredicate(
    contentColumn: SQLWrapper,
    textColumn: SQLWrapper,
    pollIds: string[],
  ): SQL {
    const predicates = pollIds.flatMap((pollId) => {
      const pattern = `%${pollId}%`
      return [
        sql`${contentColumn} like ${pattern}`,
        sql`${textColumn} like ${pattern}`,
      ]
    })

    return sql`(${sql.join(predicates, sql` or `)})`
  }

  private async findVisibleContentCandidates(
    pollIds: string[],
  ): Promise<PollContentCandidate[]> {
    if (pollIds.length === 0) return []

    const now = new Date()
    const [postRows, noteRows, pageRows] = await Promise.all([
      this.db
        .select({
          content: posts.content,
          text: posts.text,
          contentFormat: posts.contentFormat,
        })
        .from(posts)
        .where(
          sql`${posts.isPublished} = true and ${this.buildPollIdPredicate(
            posts.content,
            posts.text,
            pollIds,
          )}`,
        ),
      this.db
        .select({
          content: notes.content,
          text: notes.text,
          contentFormat: notes.contentFormat,
        })
        .from(notes)
        .where(
          sql`${notes.isPublished} = true
            and (${notes.publicAt} is null or ${notes.publicAt} <= ${now})
            and (${notes.password} is null or ${notes.password} = '')
            and ${this.buildPollIdPredicate(notes.content, notes.text, pollIds)}`,
        ),
      this.db
        .select({
          content: pages.content,
          text: pages.text,
          contentFormat: pages.contentFormat,
        })
        .from(pages)
        .where(this.buildPollIdPredicate(pages.content, pages.text, pollIds)),
    ])

    return [...postRows, ...noteRows, ...pageRows]
  }
}
