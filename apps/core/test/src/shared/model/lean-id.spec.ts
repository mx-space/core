import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'

import { normalizeDocumentIds } from '~/shared/model/plugins/lean-id'

describe('normalizeDocumentIds', () => {
  it('replaces root _id with id', () => {
    const input = {
      _id: '507f1f77bcf86cd799439011',
      title: 'hello',
    }

    const normalized = normalizeDocumentIds(input)

    expect(normalized).toBe(input)
    expect(normalized).toEqual({
      id: '507f1f77bcf86cd799439011',
      title: 'hello',
    })
    expect(normalized).not.toHaveProperty('_id')
  })

  it('does not rewrite nested plain objects without schema context', () => {
    const input = {
      _id: '507f1f77bcf86cd799439011',
      child: {
        _id: '507f191e810c19729de860ea',
        name: 'child',
      },
      items: [
        { _id: '507f191e810c19729de860eb', name: 'a' },
        { _id: '507f191e810c19729de860ec', name: 'b' },
      ],
    }

    normalizeDocumentIds(input)

    expect(input).toEqual({
      id: '507f1f77bcf86cd799439011',
      child: {
        _id: '507f191e810c19729de860ea',
        name: 'child',
      },
      items: [
        { _id: '507f191e810c19729de860eb', name: 'a' },
        { _id: '507f191e810c19729de860ec', name: 'b' },
      ],
    })
  })

  it('leaves primitive object id-like values under normal fields intact', () => {
    const input = {
      _id: '507f1f77bcf86cd799439011',
      ref: '507f191e810c19729de860ea',
    }

    normalizeDocumentIds(input)

    expect(input).toEqual({
      id: '507f1f77bcf86cd799439011',
      ref: '507f191e810c19729de860ea',
    })
  })

  it('normalizes schema-declared child documents while preserving mixed payloads', () => {
    const childSchema = new mongoose.Schema({
      name: String,
    })
    const rootSchema = new mongoose.Schema({
      child: childSchema,
      items: [childSchema],
      meta: mongoose.Schema.Types.Mixed,
    })

    const input = {
      _id: '507f1f77bcf86cd799439011',
      child: {
        _id: '507f191e810c19729de860ea',
        name: 'child',
      },
      items: [
        { _id: '507f191e810c19729de860eb', name: 'a' },
        { _id: '507f191e810c19729de860ec', name: 'b' },
      ],
      meta: {
        _id: 'user-defined',
        nested: {
          _id: 'still-user-defined',
        },
      },
    }

    normalizeDocumentIds(input, rootSchema as any)

    expect(input).toEqual({
      id: '507f1f77bcf86cd799439011',
      child: {
        id: '507f191e810c19729de860ea',
        name: 'child',
      },
      items: [
        { id: '507f191e810c19729de860eb', name: 'a' },
        { id: '507f191e810c19729de860ec', name: 'b' },
      ],
      meta: {
        _id: 'user-defined',
        nested: {
          _id: 'still-user-defined',
        },
      },
    })
  })
})
