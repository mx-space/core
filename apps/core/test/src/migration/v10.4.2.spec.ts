import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import v10_4_2 from '~/migration/version/v10.4.2'

describe('v10.4.2 comment reader ref migration', () => {
  let commentsCollection: any
  let readersCollection: any
  let accountsCollection: any
  let updateOne: ReturnType<typeof vi.fn>

  beforeEach(() => {
    updateOne = vi.fn().mockResolvedValue({})

    commentsCollection = {
      find: vi.fn(),
      updateOne,
    }

    readersCollection = {
      find: vi.fn(),
    }

    accountsCollection = {
      find: vi.fn(),
    }
  })

  const makeDb = () =>
    ({
      collection: vi.fn((name: string) => {
        if (name === 'comments') return commentsCollection
        if (name === 'readers') return readersCollection
        if (name === 'accounts') return accountsCollection
        throw new Error(`unexpected collection ${name}`)
      }),
    }) as any

  it('links a uniquely matched comment and unsets redundant fields', async () => {
    const readerId = new Types.ObjectId()
    commentsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: 'comment-1',
          mail: 'reader@example.com',
          source: 'github',
        },
      ]),
    })
    readersCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: readerId,
          email: 'reader@example.com',
        },
      ]),
    })
    accountsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          userId: readerId,
          provider: 'github',
        },
      ]),
    })

    await v10_4_2.run(makeDb(), {} as any)

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'comment-1' },
      {
        $set: { readerId: readerId.toHexString(), authProvider: 'github' },
        $unset: {
          author: 1,
          mail: 1,
          avatar: 1,
          url: 1,
          source: 1,
        },
      },
    )
  })

  it('skips comments when no matching reader account exists', async () => {
    commentsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: 'comment-1',
          mail: 'reader@example.com',
          source: 'github',
        },
      ]),
    })
    readersCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    })
    accountsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    })

    await v10_4_2.run(makeDb(), {} as any)

    expect(updateOne).not.toHaveBeenCalled()
  })

  it('skips comments when multiple reader matches remain after provider filtering', async () => {
    const readerA = new Types.ObjectId()
    const readerB = new Types.ObjectId()
    commentsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: 'comment-1',
          mail: 'shared@example.com',
          source: 'google',
        },
      ]),
    })
    readersCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { _id: readerA, email: 'shared@example.com' },
        { _id: readerB, email: 'shared@example.com' },
      ]),
    })
    accountsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { userId: readerA, providerId: 'google' },
        { userId: readerB, providerId: 'google' },
      ]),
    })

    await v10_4_2.run(makeDb(), {} as any)

    expect(updateOne).not.toHaveBeenCalled()
  })

  it('skips comments that already have readerId', async () => {
    commentsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    })

    await v10_4_2.run(makeDb(), {} as any)

    expect(updateOne).not.toHaveBeenCalled()
    expect(commentsCollection.find).toHaveBeenCalledWith(
      {
        readerId: { $exists: false },
        mail: { $exists: true, $ne: null },
        source: { $exists: true, $ne: null },
      },
      expect.any(Object),
    )
  })

  it('matches accounts when account userId is stored as string', async () => {
    const readerId = new Types.ObjectId()
    commentsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: 'comment-1',
          mail: 'reader@example.com',
          source: 'github',
        },
      ]),
    })
    readersCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: readerId,
          email: 'reader@example.com',
        },
      ]),
    })
    accountsCollection.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          userId: readerId.toHexString(),
          providerId: 'github',
        },
      ]),
    })

    await v10_4_2.run(makeDb(), {} as any)

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'comment-1' },
      expect.objectContaining({
        $set: { readerId: readerId.toHexString(), authProvider: 'github' },
      }),
    )
  })
})
