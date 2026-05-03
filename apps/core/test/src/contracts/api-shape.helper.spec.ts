import { describe, expect, it } from 'vitest'

import {
  assertHasKeys,
  assertHasKeysDeep,
  assertLowercaseRefType,
  assertNoLegacyKeys,
  assertPgTimestamps,
} from '../../../test/helper/api-shape'

describe('api-shape helper', () => {
  describe('assertNoLegacyKeys', () => {
    it('passes on a clean PG-shape object', () => {
      expect(() =>
        assertNoLegacyKeys({
          id: '1',
          created_at: '2024-01-01',
          modified_at: null,
          read_count: 1,
          like_count: 2,
        }),
      ).not.toThrow()
    })

    it('throws on legacy `_id`', () => {
      expect(() => assertNoLegacyKeys({ _id: 'abc' })).toThrow(/_id/)
    })

    it('throws on legacy `created` / `modified`', () => {
      expect(() => assertNoLegacyKeys({ created: 'x' })).toThrow(/created/)
      expect(() => assertNoLegacyKeys({ modified: 'x' })).toThrow(/modified/)
    })

    it('throws on legacy `comments_index` / `allow_comment` by default', () => {
      expect(() => assertNoLegacyKeys({ comments_index: 0 })).toThrow(
        /comments_index/,
      )
      expect(() => assertNoLegacyKeys({ allow_comment: true })).toThrow(
        /allow_comment/,
      )
    })

    it('allows whitelisted legacy keys', () => {
      expect(() =>
        assertNoLegacyKeys(
          { comments_index: 0, allow_comment: true },
          { allowed: ['comments_index', 'allow_comment'] },
        ),
      ).not.toThrow()
    })

    it('throws on legacy `count: { read, like }` shape', () => {
      expect(() => assertNoLegacyKeys({ count: { read: 1, like: 2 } })).toThrow(
        /count/,
      )
    })

    it('does NOT throw on `count` with unrelated value', () => {
      // Some unrelated entity using `count` for a different purpose.
      expect(() => assertNoLegacyKeys({ count: 42 })).not.toThrow()
    })

    it('walks arrays and nested objects', () => {
      expect(() =>
        assertNoLegacyKeys({ data: [{ child: { _id: 'x' } }] }),
      ).toThrow(/_id/)
    })
  })

  describe('assertPgTimestamps', () => {
    it('passes on a PG-shape entity', () => {
      expect(() =>
        assertPgTimestamps({
          id: '1',
          created_at: '2024-01-01',
          modified_at: null,
        }),
      ).not.toThrow()
    })

    it('throws on missing `id`', () => {
      expect(() => assertPgTimestamps({ created_at: 'x' })).toThrow(/id/)
    })

    it('throws on missing `created_at`', () => {
      expect(() => assertPgTimestamps({ id: '1' })).toThrow(/created_at/)
    })

    it('throws on legacy `created` field', () => {
      expect(() =>
        assertPgTimestamps({ id: '1', created_at: 'x', created: 'y' }),
      ).toThrow(/created/)
    })
  })

  describe('assertHasKeys', () => {
    it('passes when every required key is present (incl. null)', () => {
      expect(() =>
        assertHasKeys({ id: '1', created_at: 'x', modified_at: null }, [
          'id',
          'created_at',
          'modified_at',
        ]),
      ).not.toThrow()
    })

    it('throws on missing key', () => {
      expect(() => assertHasKeys({ id: '1' }, ['id', 'created_at'])).toThrow(
        /created_at/,
      )
    })

    it('throws on `undefined` value', () => {
      expect(() =>
        assertHasKeys({ id: '1', created_at: undefined }, ['created_at']),
      ).toThrow(/created_at/)
    })
  })

  describe('assertHasKeysDeep', () => {
    it('passes on nested object paths', () => {
      expect(() =>
        assertHasKeysDeep({ category: { slug: 'tech', name: 'Tech' } }, [
          'category.slug',
          'category.name',
        ]),
      ).not.toThrow()
    })

    it('passes on array-index paths', () => {
      expect(() =>
        assertHasKeysDeep({ related: [{ title: 'A' }] }, ['related.0.title']),
      ).not.toThrow()
    })

    it('throws on missing nested key', () => {
      expect(() =>
        assertHasKeysDeep({ category: { name: 'x' } }, ['category.slug']),
      ).toThrow(/category\.slug/)
    })

    it('throws when intermediate is null', () => {
      expect(() =>
        assertHasKeysDeep({ category: null }, ['category.slug']),
      ).toThrow(/category\.slug/)
    })
  })

  describe('assertLowercaseRefType', () => {
    it('passes on lowercase singular ref_type', () => {
      expect(() => assertLowercaseRefType({ ref_type: 'post' })).not.toThrow()
      expect(() => assertLowercaseRefType({ ref_type: 'note' })).not.toThrow()
    })

    it('throws on PascalCase ref_type values', () => {
      expect(() => assertLowercaseRefType({ ref_type: 'Post' })).toThrow(/Post/)
      expect(() => assertLowercaseRefType({ ref_type: 'Note' })).toThrow(/Note/)
    })

    it('throws on plural ref_type values', () => {
      expect(() => assertLowercaseRefType({ ref_type: 'posts' })).toThrow(
        /posts/,
      )
      expect(() => assertLowercaseRefType({ ref_type: 'recentlies' })).toThrow(
        /recentlies/,
      )
    })

    it('walks nested arrays', () => {
      expect(() =>
        assertLowercaseRefType({ data: [{ ref_type: 'Post' }] }),
      ).toThrow(/Post/)
    })
  })
})
