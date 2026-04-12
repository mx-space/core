import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import {
  brandEntityId,
  isObjectIdString,
  parseObjectIdString,
  toObjectId,
  toObjectIdArray,
  unsafeObjectIdString,
} from '~/shared/id'

describe('shared id utilities', () => {
  it('brands valid object id strings', () => {
    const value = '507f1f77bcf86cd799439011'
    const id = parseObjectIdString(value)

    expect(id).toBe(value)
    expect(isObjectIdString(id)).toBe(true)
  })

  it('rejects invalid object id strings', () => {
    expect(() => parseObjectIdString('id-1')).toThrow(
      'Invalid MongoDB ObjectId',
    )
  })

  it('converts branded ids to Types.ObjectId', () => {
    const id = unsafeObjectIdString('507f1f77bcf86cd799439011')
    const objectId = toObjectId(id)

    expect(objectId).toBeInstanceOf(Types.ObjectId)
    expect(objectId.toHexString()).toBe(id)
  })

  it('converts branded id arrays to Types.ObjectId arrays', () => {
    const ids = [
      unsafeObjectIdString('507f1f77bcf86cd799439011'),
      unsafeObjectIdString('507f191e810c19729de860ea'),
    ]

    const objectIds = toObjectIdArray(ids)

    expect(objectIds.map((item) => item.toHexString())).toEqual(ids)
  })

  it('brands entity ids without changing runtime values', () => {
    const id = unsafeObjectIdString('507f1f77bcf86cd799439011')
    const postId = brandEntityId<'post'>(id)

    expect(postId).toBe(id)
  })
})
