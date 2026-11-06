import { describe, expect, it } from 'vitest'

import {
  type AgentMetaFormState,
  applyWriteAgentMetaUpdates,
  getWriteAgentMetaFields,
  getWriteAgentMetaSchema,
} from './agent-meta-fields'

const baseState: AgentMetaFormState = {
  bookmark: false,
  contentFormat: 'lexical',
  copyright: true,
  freeUntil: '',
  freeWindowHours: '72',
  isPremium: false,
  location: '',
  mood: '',
  order: '',
  pin: false,
  pinOrder: '1',
  previewBlocks: '3',
  purchaseEnabled: true,
  slug: '',
  subtitle: '',
  summary: '',
  tags: 'a, b',
  title: 'Hello',
  weather: '',
}

describe('agent meta fields registry', () => {
  it('derives schema keys per kind from one registry', () => {
    expect(Object.keys(getWriteAgentMetaSchema('post'))).toEqual([
      'title',
      'slug',
      'tags',
      'summary',
      'copyright',
      'pin',
      'pinOrder',
      'isPremium',
      'purchaseEnabled',
      'freeUntil',
      'freeWindowHours',
      'previewBlocks',
    ])
    expect(Object.keys(getWriteAgentMetaSchema('note'))).toEqual([
      'title',
      'slug',
      'mood',
      'weather',
      'bookmark',
      'location',
    ])
    expect(Object.keys(getWriteAgentMetaSchema('page'))).toEqual([
      'title',
      'slug',
      'subtitle',
      'order',
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

  it('ignores keys that do not belong to the kind', () => {
    const next = applyWriteAgentMetaUpdates('page', baseState, {
      isPremium: true,
    })
    expect(next.isPremium).toBe(false)
  })
})
