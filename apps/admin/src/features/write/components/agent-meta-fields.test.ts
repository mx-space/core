import { describe, expect, it } from 'vitest'

import {
  type AgentMetaFormState,
  applyWriteAgentMetaUpdates,
  getWriteAgentMetaFields,
  getWriteAgentMetaSchema,
} from './agent-meta-fields'

const baseState: AgentMetaFormState = {
  bookmark: false,
  categoryId: 'c1',
  contentFormat: 'lexical',
  coordinatesLat: '',
  coordinatesLng: '',
  copyright: true,
  freeUntil: '',
  freeWindowHours: '72',
  isPremium: false,
  location: '',
  meta: {},
  mood: '',
  order: '',
  password: '',
  passwordProtected: false,
  pin: false,
  pinOrder: '1',
  previewBlocks: '3',
  publicAt: '',
  purchaseEnabled: true,
  relatedId: '',
  slug: '',
  subtitle: '',
  summary: '',
  tags: 'a, b',
  title: 'Hello',
  topicId: '',
  weather: '',
}

const context = {
  categories: [
    { id: 'c1', name: '技术', slug: 'tech' },
    { id: 'c2', name: '随笔', slug: 'essay' },
  ],
  relatedPosts: [],
  topics: [{ id: 't1', name: '旅行', slug: 'travel' }],
}

describe('agent meta fields registry', () => {
  it('derives schema keys per kind from one registry', () => {
    expect(Object.keys(getWriteAgentMetaSchema('post'))).toEqual([
      'title',
      'slug',
      'category',
      'tags',
      'summary',
      'copyright',
      'pin',
      'pinOrder',
      'related',
      'isPremium',
      'purchaseEnabled',
      'freeUntil',
      'freeWindowHours',
      'previewBlocks',
      'cover',
      'meta',
    ])
    expect(Object.keys(getWriteAgentMetaSchema('note'))).toEqual([
      'title',
      'slug',
      'topic',
      'mood',
      'weather',
      'bookmark',
      'publicAt',
      'location',
      'coordinates',
      'passwordProtected',
      'password',
      'cover',
      'meta',
    ])
    expect(Object.keys(getWriteAgentMetaSchema('page'))).toEqual([
      'title',
      'slug',
      'subtitle',
      'order',
      'cover',
      'meta',
    ])
  })

  it('reads exactly the schema keys', () => {
    for (const kind of ['post', 'note', 'page'] as const) {
      expect(Object.keys(getWriteAgentMetaFields(kind, baseState))).toEqual(
        Object.keys(getWriteAgentMetaSchema(kind)),
      )
    }
  })

  it('reads paywall fields with numeric types', () => {
    const fields = getWriteAgentMetaFields('post', {
      ...baseState,
      freeUntil: '2026-12-01T00:00:00.000Z',
      isPremium: true,
    })
    expect(fields).toMatchObject({
      freeUntil: '2026-12-01T00:00:00.000Z',
      freeWindowHours: 72,
      isPremium: true,
      previewBlocks: 3,
      purchaseEnabled: true,
      tags: ['a', 'b'],
    })
  })

  it('writes paywall fields into form state', () => {
    const next = applyWriteAgentMetaUpdates('post', baseState, {
      freeUntil: '2026-12-01T08:00:00+08:00',
      freeWindowHours: 24,
      isPremium: true,
      previewBlocks: 5,
      purchaseEnabled: false,
    })
    expect(next).toMatchObject({
      freeUntil: '2026-12-01T00:00:00.000Z',
      freeWindowHours: '24',
      isPremium: true,
      previewBlocks: '5',
      purchaseEnabled: false,
    })
  })

  it('clears freeUntil with an empty value', () => {
    const next = applyWriteAgentMetaUpdates(
      'post',
      { ...baseState, freeUntil: '2026-12-01T00:00:00.000Z' },
      { freeUntil: null },
    )
    expect(next.freeUntil).toBe('')
  })

  it('rejects premium on non-lexical content without changing state', () => {
    expect(() =>
      applyWriteAgentMetaUpdates(
        'post',
        { ...baseState, contentFormat: 'markdown' },
        { isPremium: true, title: 'Changed' },
      ),
    ).toThrow(/Lexical/)
  })

  it('rejects invalid paywall values', () => {
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { previewBlocks: 0 }),
    ).toThrow(/previewBlocks/)
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { freeWindowHours: -1 }),
    ).toThrow(/freeWindowHours/)
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { freeUntil: 'tomorrow' }),
    ).toThrow(/freeUntil/)
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { isPremium: 'yes' }),
    ).toThrow(/isPremium/)
  })

  it('keeps existing field coercion', () => {
    const post = applyWriteAgentMetaUpdates('post', baseState, {
      pin: true,
      tags: ['x', 'y'],
    })
    expect(post).toMatchObject({ pin: true, pinOrder: '1', tags: 'x, y' })

    const unpinned = applyWriteAgentMetaUpdates(
      'post',
      { ...baseState, pin: true, pinOrder: '4' },
      { pin: false },
    )
    expect(unpinned.pinOrder).toBe('0')

    const note = applyWriteAgentMetaUpdates('note', baseState, {
      bookmark: 1,
      location: null,
      mood: 'happy',
    })
    expect(note).toMatchObject({ bookmark: true, location: '', mood: 'happy' })

    const page = applyWriteAgentMetaUpdates('page', baseState, { order: '7' })
    expect(page.order).toBe('7')
  })

  const relatedPosts = [
    { id: '101', slug: 'ai-efficiency', title: 'AI 时代的效率悖论' },
    { id: '102', slug: 'design-taste', title: '设计与审美' },
  ]

  it('reads related posts as id and title pairs', () => {
    const fields = getWriteAgentMetaFields(
      'post',
      { ...baseState, relatedId: '101, 999' },
      { relatedPosts },
    )
    expect(fields.related).toEqual([
      { id: '101', title: 'AI 时代的效率悖论' },
      { id: '999' },
    ])
  })

  it('writes related posts resolved by id, slug or title', () => {
    const next = applyWriteAgentMetaUpdates(
      'post',
      baseState,
      { related: ['ai-efficiency', '设计与审美', '999'] },
      { relatedPosts },
    )
    expect(next.relatedId).toBe('101, 102, 999')
  })

  it('clears related posts with an empty array', () => {
    const next = applyWriteAgentMetaUpdates(
      'post',
      { ...baseState, relatedId: '101' },
      { related: [] },
      { relatedPosts },
    )
    expect(next.relatedId).toBe('')
  })

  it('rejects related values that match no post', () => {
    expect(() =>
      applyWriteAgentMetaUpdates(
        'post',
        baseState,
        { related: ['不存在的文章'] },
        { relatedPosts },
      ),
    ).toThrow(/不存在的文章/)
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { related: '101' }),
    ).toThrow(/related/)
  })

  it('reads and writes category by id, slug or name', () => {
    expect(
      getWriteAgentMetaFields('post', baseState, context).category,
    ).toEqual({ id: 'c1', name: '技术' })
    for (const value of ['c2', 'essay', '随笔']) {
      expect(
        applyWriteAgentMetaUpdates(
          'post',
          baseState,
          { category: value },
          context,
        ).categoryId,
      ).toBe('c2')
    }
    expect(() =>
      applyWriteAgentMetaUpdates(
        'post',
        baseState,
        { category: '不存在' },
        context,
      ),
    ).toThrow(/category/)
  })

  it('reads and writes note topic, clearing with null', () => {
    const next = applyWriteAgentMetaUpdates(
      'note',
      baseState,
      { topic: 'travel' },
      context,
    )
    expect(next.topicId).toBe('t1')
    expect(getWriteAgentMetaFields('note', next, context).topic).toEqual({
      id: 't1',
      name: '旅行',
    })
    expect(
      applyWriteAgentMetaUpdates('note', next, { topic: null }, context)
        .topicId,
    ).toBe('')
    expect(getWriteAgentMetaFields('note', baseState, context).topic).toBeNull()
  })

  it('round-trips a future publicAt and rejects past values', () => {
    const iso = '2099-01-02T03:04:00.000Z'
    const next = applyWriteAgentMetaUpdates('note', baseState, {
      publicAt: iso,
    })
    expect(getWriteAgentMetaFields('note', next).publicAt).toBe(iso)
    expect(
      applyWriteAgentMetaUpdates('note', next, { publicAt: null }).publicAt,
    ).toBe('')
    expect(() =>
      applyWriteAgentMetaUpdates('note', baseState, {
        publicAt: '2000-01-01T00:00:00.000Z',
      }),
    ).toThrow(/publicAt/)
  })

  it('reads and writes note coordinates', () => {
    const next = applyWriteAgentMetaUpdates('note', baseState, {
      coordinates: { latitude: 35.68, longitude: 139.76 },
    })
    expect(next).toMatchObject({
      coordinatesLat: '35.68',
      coordinatesLng: '139.76',
    })
    expect(getWriteAgentMetaFields('note', next).coordinates).toEqual({
      latitude: 35.68,
      longitude: 139.76,
    })
    expect(
      applyWriteAgentMetaUpdates('note', next, { coordinates: null }),
    ).toMatchObject({ coordinatesLat: '', coordinatesLng: '' })
    expect(() =>
      applyWriteAgentMetaUpdates('note', baseState, {
        coordinates: { latitude: 91, longitude: 0 },
      }),
    ).toThrow(/coordinates/)
  })

  it('writes the note password without exposing it on read', () => {
    const next = applyWriteAgentMetaUpdates('note', baseState, {
      password: 'secret',
    })
    expect(next).toMatchObject({ password: 'secret', passwordProtected: true })
    const fields = getWriteAgentMetaFields('note', next)
    expect(fields.passwordProtected).toBe(true)
    expect(JSON.stringify(fields)).not.toContain('secret')

    const off = applyWriteAgentMetaUpdates('note', next, {
      passwordProtected: false,
    })
    expect(off).toMatchObject({ password: '', passwordProtected: false })
  })

  it('writes cover into meta and clears it with an empty value', () => {
    const next = applyWriteAgentMetaUpdates('page', baseState, {
      cover: 'https://example.com/a.png',
    })
    expect(next.meta).toEqual({ cover: 'https://example.com/a.png' })
    expect(getWriteAgentMetaFields('page', next).cover).toBe(
      'https://example.com/a.png',
    )
    expect(
      applyWriteAgentMetaUpdates('page', next, { cover: '' }).meta,
    ).toEqual({})
  })

  it('merges meta updates, removing keys set to null', () => {
    const next = applyWriteAgentMetaUpdates(
      'post',
      { ...baseState, meta: { cover: 'x', lang: 'zh' } },
      { meta: { lang: null, skillIds: ['s1'] } },
    )
    expect(next.meta).toEqual({ cover: 'x', skillIds: ['s1'] })
  })

  it('rejects meta writes to the paywall key', () => {
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, {
        meta: { paywall: { previewBlocks: 1 } },
      }),
    ).toThrow(/paywall/)
    expect(() =>
      applyWriteAgentMetaUpdates('post', baseState, { meta: 'x' }),
    ).toThrow(/meta/)
  })

  it('ignores keys that do not belong to the kind', () => {
    const next = applyWriteAgentMetaUpdates('page', baseState, {
      isPremium: true,
    })
    expect(next.isPremium).toBe(false)
  })
})
