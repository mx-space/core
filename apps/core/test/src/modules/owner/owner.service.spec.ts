import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OWNER_PROFILE_COLLECTION_NAME,
  READER_COLLECTION_NAME,
} from '~/constants/db.constant'
import { OwnerService } from '~/modules/owner/owner.service'

describe('OwnerService canonical id output', () => {
  let service: OwnerService
  let ownerId: Types.ObjectId

  const ownerProfileModel = {
    updateOne: vi.fn(),
  }

  const eventManager = {
    emit: vi.fn(),
  }

  const readersCollection = {
    find: vi.fn(),
  }

  const ownerProfileCollection = {
    findOne: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ownerId = new Types.ObjectId()

    readersCollection.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({
            _id: ownerId,
            username: 'owner',
            name: 'Owner Name',
            email: 'owner@example.com',
            image: 'https://example.com/avatar.png',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        }),
      }),
    })

    ownerProfileCollection.findOne.mockResolvedValue({
      mail: 'owner@example.com',
      url: 'https://example.com',
      created: new Date('2026-01-02T00:00:00.000Z'),
    })

    service = new OwnerService(
      {
        db: {
          collection: vi.fn((name: string) => {
            switch (name) {
              case READER_COLLECTION_NAME: {
                return readersCollection
              }
              case OWNER_PROFILE_COLLECTION_NAME: {
                return ownerProfileCollection
              }
              default: {
                throw new Error(`Unexpected collection: ${name}`)
              }
            }
          }),
        },
      } as any,
      ownerProfileModel as any,
      eventManager as any,
    )
  })

  it('returns only canonical id in owner info', async () => {
    const owner = await service.getOwnerInfo()

    expect(owner.id).toBe(ownerId.toHexString())
    expect(owner).not.toHaveProperty('_id')
  })
})
