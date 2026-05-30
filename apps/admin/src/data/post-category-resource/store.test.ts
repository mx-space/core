// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PaginateResult } from '~/models/base'
import { CategoryType } from '~/models/category'
import type { CategoryModel } from '~/models/category'
import type { Category, PostModel } from '~/models/post'

import {
  resetPostCategoryResourceStoreForTest,
  selectPostList,
  selectVisiblePost,
  serializeResourceListKey,
  usePostCategoryResourceStore,
} from './store'
import { PostCategoryResourceTransaction } from './transaction'

const listKey = serializeResourceListKey(['posts', 'list', { page: 1 }])

describe('post category resource store', () => {
  beforeEach(() => {
    resetPostCategoryResourceStoreForTest()
  })

  it('normalizes embedded post categories and projects list rows from the store', () => {
    const store = usePostCategoryResourceStore.getState()

    store.hydratePostList(listKey, paginated([post({ id: 'p1' })]))

    const state = usePostCategoryResourceStore.getState()
    const list = selectPostList(state, listKey)

    expect(state.categoriesById.c1?.name).toBe('Tech')
    expect(state.postIdsByCategoryId.c1).toEqual(['p1'])
    expect(list.posts).toHaveLength(1)
    expect(list.posts[0].category.name).toBe('Tech')
  })

  it('keeps pending category changes visible when a stale query result arrives', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydrateCategories([
      categoryModel({ id: 'c1' }),
      categoryModel({ id: 'c2', name: 'Life' }),
    ])
    store.hydratePostList(listKey, paginated([post({ id: 'p1' })]))

    const transactionId = store.beginPostPatchTransaction('p1', {
      categoryId: 'c2',
    })

    store.hydratePostList(listKey, paginated([post({ id: 'p1' })]))

    let state = usePostCategoryResourceStore.getState()
    expect(selectVisiblePost(state, 'p1')?.categoryId).toBe('c2')
    expect(selectVisiblePost(state, 'p1')?.category.name).toBe('Life')
    expect(state.postIdsByCategoryId.c2).toEqual(['p1'])

    store.commitPostTransaction(
      transactionId,
      post({
        category: category({ id: 'c2', name: 'Life' }),
        categoryId: 'c2',
        id: 'p1',
      }),
    )

    state = usePostCategoryResourceStore.getState()
    expect(selectVisiblePost(state, 'p1')?.categoryId).toBe('c2')
    expect(state.pendingTransactionIdsByPostId.p1).toBeUndefined()
  })

  it('removes only the failed transaction and replays later pending writes', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydratePostList(listKey, paginated([post({ id: 'p1', title: 'A' })]))

    const firstTransactionId = store.beginPostPatchTransaction('p1', {
      title: 'B',
    })
    store.beginPostPatchTransaction('p1', {
      title: 'C',
    })

    store.rollbackPostTransaction(firstTransactionId, new Error('failed'))

    const state = usePostCategoryResourceStore.getState()
    expect(selectVisiblePost(state, 'p1')?.title).toBe('C')
    expect(state.errorsByPostId.p1).toBeInstanceOf(Error)
  })

  it('can roll back an optimistic delete', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydratePostList(listKey, paginated([post({ id: 'p1' })]))

    const transactionId = store.beginPostDeleteTransaction('p1')

    expect(
      selectPostList(usePostCategoryResourceStore.getState(), listKey).posts,
    ).toHaveLength(0)

    store.rollbackPostTransaction(transactionId)

    expect(
      selectPostList(usePostCategoryResourceStore.getState(), listKey).posts,
    ).toHaveLength(1)
  })

  it('hydrates detail rows into the shared post table', () => {
    const store = usePostCategoryResourceStore.getState()

    store.hydratePostDetail(post({ id: 'p1', title: 'Detail title' }))

    const state = usePostCategoryResourceStore.getState()
    expect(selectVisiblePost(state, 'p1')?.title).toBe('Detail title')
    expect(state.postIdsByCategoryId.c1).toEqual(['p1'])
  })

  it('updates visible post category data when category management saves', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydratePostDetail(post({ id: 'p1' }))

    store.hydrateCategory(
      categoryModel({ id: 'c1', name: 'Engineering', slug: 'engineering' }),
    )

    const visiblePost = selectVisiblePost(
      usePostCategoryResourceStore.getState(),
      'p1',
    )
    expect(visiblePost?.category.name).toBe('Engineering')
    expect(visiblePost?.category.slug).toBe('engineering')
  })

  it('removes category management rows without deleting posts', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydrateCategories([categoryModel({ id: 'c1' })])
    store.hydratePostDetail(post({ id: 'p1' }))

    store.removeCategory('c1')

    const state = usePostCategoryResourceStore.getState()
    expect(state.categoryIds).toEqual([])
    expect(selectVisiblePost(state, 'p1')?.id).toBe('p1')
  })

  it('supports class-based transaction commit and rollback', () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydratePostList(listKey, paginated([post({ id: 'p1', title: 'A' })]))

    new PostCategoryResourceTransaction()
      .patchPost('p1', { title: 'B' })
      .rollback()

    expect(
      selectVisiblePost(usePostCategoryResourceStore.getState(), 'p1')?.title,
    ).toBe('A')

    new PostCategoryResourceTransaction()
      .patchPost('p1', { title: 'B' })
      .commitPost('p1', post({ id: 'p1', title: 'B' }))

    expect(
      selectVisiblePost(usePostCategoryResourceStore.getState(), 'p1')?.title,
    ).toBe('B')
  })

  it('runs request-backed transaction lifecycle', async () => {
    const store = usePostCategoryResourceStore.getState()
    store.hydratePostList(listKey, paginated([post({ id: 'p1', title: 'A' })]))

    const successTx = new PostCategoryResourceTransaction<PostModel>(
      'renamePost',
    )
      .patchPost('p1', { title: 'B' })
    successTx.request = async () => post({ id: 'p1', title: 'B' })
    successTx.onSuccess = (serverPost: PostModel) => {
      successTx.commitPost(serverPost.id, serverPost)
    }

    await expect(successTx.commit()).resolves.toMatchObject({
      title: 'B',
    })
    expect(
      selectVisiblePost(usePostCategoryResourceStore.getState(), 'p1')?.title,
    ).toBe('B')

    const onError = vi.fn()
    const failedTx = new PostCategoryResourceTransaction<PostModel>(
      'failedRename',
    )
      .patchPost('p1', { title: 'C' })
    failedTx.request = async () => {
      throw new Error('failed')
    }
    failedTx.onError = onError

    await expect(failedTx.commit()).rejects.toThrow('failed')
    expect(
      selectVisiblePost(usePostCategoryResourceStore.getState(), 'p1')?.title,
    ).toBe('B')
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

function paginated(data: PostModel[]): PaginateResult<PostModel> {
  return {
    data,
    pagination: {
      page: 1,
      size: 10,
      total: data.length,
      totalPages: 1,
    },
  }
}

function post(overrides: Partial<PostModel> = {}): PostModel {
  const baseCategory = overrides.category ?? category()

  return {
    category: baseCategory,
    categoryId: baseCategory.id,
    contentFormat: 'markdown',
    copyright: false,
    createdAt: '2026-05-30T00:00:00.000Z',
    id: 'p1',
    images: [],
    isPublished: false,
    likeCount: 0,
    modifiedAt: null,
    pinAt: null,
    pinOrder: null,
    readCount: 0,
    slug: 'post-1',
    tags: [],
    text: 'Post text',
    title: 'Post title',
    ...overrides,
  }
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Tech',
    slug: 'tech',
    type: CategoryType.Category,
    ...overrides,
  }
}

function categoryModel(overrides: Partial<CategoryModel> = {}): CategoryModel {
  return {
    count: 0,
    createdAt: '2026-05-30T00:00:00.000Z',
    id: 'c1',
    name: 'Tech',
    slug: 'tech',
    type: CategoryType.Category,
    ...overrides,
  }
}
