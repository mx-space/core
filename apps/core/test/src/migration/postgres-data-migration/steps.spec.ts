import { normalizeLegacyJsonbObject } from '~/migration/postgres-data-migration/steps'
import type { MigrationContext } from '~/migration/postgres-data-migration/types'

const buildContext = (): MigrationContext =>
  ({
    reports: {
      duplicateKeys: [],
      missingRefs: [],
      rowsLoaded: {},
      rowsRead: {},
      startedAt: new Date(),
      warnings: [],
    },
  }) as MigrationContext

describe('normalizeLegacyJsonbObject', () => {
  it('parses legacy JSON string metadata into an object', () => {
    const ctx = buildContext()

    expect(
      normalizeLegacyJsonbObject(
        ctx,
        'posts',
        'mongo-post-id',
        'meta',
        '{"lang":"en","cover":{"src":"cover.png"}}',
      ),
    ).toEqual({
      cover: { src: 'cover.png' },
      lang: 'en',
    })
    expect(ctx.reports.warnings).toHaveLength(0)
  })

  it('preserves object metadata and normalizes invalid jsonb object values', () => {
    const ctx = buildContext()
    const meta = { lang: 'zh-CN' }

    expect(
      normalizeLegacyJsonbObject(ctx, 'notes', 'mongo-note-id', 'meta', meta),
    ).toBe(meta)
    expect(
      normalizeLegacyJsonbObject(ctx, 'pages', 'mongo-page-id', 'meta', '['),
    ).toBeNull()
    expect(
      normalizeLegacyJsonbObject(ctx, 'drafts', 'mongo-draft-id', 'meta', [
        'not-object',
      ]),
    ).toBeNull()
    expect(ctx.reports.warnings).toEqual([
      {
        collection: 'pages',
        mongoId: 'mongo-page-id',
        reason: 'meta contains invalid JSON string',
      },
      {
        collection: 'drafts',
        mongoId: 'mongo-draft-id',
        reason: 'meta must be a JSON object; received array',
      },
    ])
  })
})
