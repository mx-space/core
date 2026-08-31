import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { describe, expect, it, vi } from 'vitest'

import { migration } from '~/database/app-migrations/20260831-tree-content-revisions'

describe('tree content revision migration', () => {
  it('converts a published legacy version and later draft into one branch', async () => {
    const context = await createPgTestDatabase('mx_tree_revisions')
    try {
      await context.pool.query(`
        INSERT INTO categories (id, name, slug)
        VALUES ('100', 'Tech', 'tech');

        INSERT INTO posts
          (id, title, slug, text, content_format, category_id, images)
        VALUES
          ('200', 'Published title', 'published-title', 'Published body', 'markdown', '100', '[{"src":"published.png"}]');

        INSERT INTO legacy_drafts
          (id, ref_type, ref_id, title, text, content_format,
           images, type_specific_data, history, version, published_version)
        VALUES
          ('300', 'post', '200', 'Draft title', 'Draft body', 'markdown',
           '[{"src":"draft.png"}]',
           '{"slug":"published-title","categoryId":"100"}'::jsonb,
           '[{"version":1,"title":"Published title","text":"Published body","contentFormat":"markdown","images":[{"src":"published.png"}],"typeSpecificData":{"slug":"published-title","categoryId":"100"},"savedAt":"2026-08-30T00:00:00.000Z","isFullSnapshot":true}]'::jsonb,
           2, 1);
      `)

      await migration.up({
        db: context.db,
        logger: { log: vi.fn() } as never,
        pool: context.pool,
      })

      const result = await context.pool.query(`
        SELECT
          d.id,
          d.base_revision_id,
          d.head_revision_id,
          cd.published_revision_id,
          base.title AS base_title,
          head.title AS head_title,
          head.images AS head_images
        FROM drafts d
        JOIN content_documents cd ON cd.id = d.document_id
        JOIN content_revisions base ON base.id = d.base_revision_id
        JOIN content_revisions head ON head.id = d.head_revision_id
      `)
      expect(result.rows).toEqual([
        expect.objectContaining({
          base_revision_id: expect.any(String),
          base_title: 'Published title',
          head_revision_id: expect.any(String),
          head_images: [{ src: 'draft.png' }],
          head_title: 'Draft title',
          id: '300',
        }),
      ])
      expect(result.rows[0].published_revision_id).toBe(
        result.rows[0].base_revision_id,
      )
      expect(result.rows[0].head_revision_id).not.toBe(
        result.rows[0].base_revision_id,
      )

      const legacy = await context.pool.query(`
        SELECT
          to_regclass('public.legacy_drafts') AS drafts,
          to_regclass('public.legacy_draft_histories') AS histories
      `)
      expect(legacy.rows[0]).toEqual({ drafts: null, histories: null })
    } finally {
      await context.close()
    }
  }, 120_000)
})
