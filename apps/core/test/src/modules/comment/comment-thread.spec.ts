import { describe, expect, it, vi } from 'vitest'

import {
  createCommentRow,
  createCommentServiceFixture,
} from '@/helper/comment-service-fixture'

describe('CommentService thread queries', () => {
  it('attaches PG ref summaries to comment rows in admin lists', async () => {
    const { service } = createCommentServiceFixture()

    await expect(
      service.attachRef([createCommentRow()]),
    ).resolves.toMatchObject([
      {
        id: 'comment-1',
        ref: {
          id: 'post-1',
          title: 'Post',
          slug: 'post',
          category: { name: 'Default', slug: 'default' },
        },
      },
    ])
  })

  it('returns empty ref summaries when comments have no target ref', async () => {
    const { service } = createCommentServiceFixture()

    await expect(
      service.attachRef([createCommentRow({ refId: null as any })]),
    ).resolves.toMatchObject([{ id: 'comment-1', ref: null }])
  })

  it('attaches a slim parent preview to replies in a single batched lookup', async () => {
    const { repository, service } = createCommentServiceFixture()
    const parent = createCommentRow({
      id: 'comment-parent',
      author: 'Bob',
      text: 'parent body',
      isDeleted: false,
    })
    repository.findManyByIds.mockResolvedValue([parent])

    const rows = [
      createCommentRow({ id: 'reply-1', parentCommentId: 'comment-parent' }),
      createCommentRow({ id: 'reply-2', parentCommentId: 'comment-parent' }),
      createCommentRow({ id: 'root-1', parentCommentId: null }),
    ]

    const enriched = await service.attachParentPreview(rows)

    expect(repository.findManyByIds).toHaveBeenCalledTimes(1)
    // Deduplicated parent ids — reply-1 and reply-2 share a parent, so the
    // repository must be called once with a single id, not twice.
    expect(repository.findManyByIds).toHaveBeenCalledWith(['comment-parent'])
    expect(enriched).toMatchObject([
      {
        id: 'reply-1',
        parent: {
          id: 'comment-parent',
          author: 'Bob',
          text: 'parent body',
          isDeleted: false,
        },
      },
      {
        id: 'reply-2',
        parent: { id: 'comment-parent', author: 'Bob' },
      },
      { id: 'root-1', parent: null },
    ])
    // Slim preview: must NOT carry ip/agent/mail/etc. so the public detail
    // endpoint does not leak parent commenter PII.
    expect(Object.keys(enriched[0].parent!).sort()).toEqual([
      'author',
      'id',
      'isDeleted',
      'text',
    ])
  })

  it('skips the repository call entirely when no row has a parent', async () => {
    const { repository, service } = createCommentServiceFixture()
    const rows = [
      createCommentRow({ id: 'a', parentCommentId: null }),
      createCommentRow({ id: 'b', parentCommentId: null }),
    ]

    const enriched = await service.attachParentPreview(rows)

    expect(repository.findManyByIds).not.toHaveBeenCalled()
    expect(enriched).toMatchObject([
      { id: 'a', parent: null },
      { id: 'b', parent: null },
    ])
  })

  it('emits parent: null when the referenced parent has been deleted', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.findManyByIds.mockResolvedValue([])

    const enriched = await service.attachParentPreview([
      createCommentRow({ id: 'reply-1', parentCommentId: 'missing-parent' }),
    ])

    expect(enriched).toMatchObject([{ id: 'reply-1', parent: null }])
  })

  it('resolves parent author through fillAndReplaceAvatarUrl so reader names win', async () => {
    const { repository, service } = createCommentServiceFixture()
    const parent = createCommentRow({
      id: 'comment-parent',
      author: null,
      readerId: 'reader-9',
      text: 'parent body',
    })
    repository.findManyByIds.mockResolvedValue([parent])
    const fillSpy = vi
      .spyOn(service, 'fillAndReplaceAvatarUrl')
      .mockImplementation(async (rows: any[]) => {
        for (const row of rows) {
          if (row.id === 'comment-parent') row.author = 'Reader Nine'
        }
        return rows
      })

    const enriched = await service.attachParentPreview([
      createCommentRow({ id: 'reply-1', parentCommentId: 'comment-parent' }),
    ])

    expect(fillSpy).toHaveBeenCalledTimes(1)
    expect(enriched[0].parent).toMatchObject({
      id: 'comment-parent',
      author: 'Reader Nine',
    })
  })

  it('returns source candidates from commented refs', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.findSourceCandidates.mockResolvedValue([
      {
        refId: 'post-1',
        refType: 'post',
        count: 3,
        latestCommentAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ])

    const candidates = await service.getSourceCandidates({ search: 'post' })

    expect(repository.findSourceCandidates).toHaveBeenCalledWith({
      refType: undefined,
      size: 100,
    })
    expect(candidates).toMatchObject([
      {
        id: 'post-1',
        type: 'post',
        title: 'Post',
        commentCount: 3,
      },
    ])
  })

  it('loads an admin thread from a child comment and preserves the selected item', async () => {
    const { repository, service } = createCommentServiceFixture()
    const root = createCommentRow({ id: 'root-1' })
    const child = createCommentRow({
      id: 'child-1',
      parentCommentId: 'root-1',
      rootCommentId: 'root-1',
      state: 2,
    })
    repository.findById.mockResolvedValue(child)
    repository.findAdminThreadByRoot.mockResolvedValue([root, child])
    repository.findManyByIds.mockResolvedValue([root])

    const result = await service.getAdminThreadForComment('child-1')

    expect(repository.findAdminThreadByRoot).toHaveBeenCalledWith('root-1')
    expect(result).toMatchObject({
      currentCommentId: 'child-1',
      rootCommentId: 'root-1',
      current: { id: 'child-1', state: 2 },
      root: { id: 'root-1' },
      thread: [{ id: 'root-1' }, { id: 'child-1' }],
    })
  })
})
