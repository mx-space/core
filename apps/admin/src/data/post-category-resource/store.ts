import { produce } from 'immer'
import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'

import type { PaginateResult, Pager } from '~/models/base'
import type { CategoryModel } from '~/models/category'
import type { Category, PostModel } from '~/models/post'

type ResourceCategory = Category | CategoryModel

interface PostListIndex {
  ids: string[]
  pagination?: Pager
  updatedAt: number
}

interface PostTransaction {
  id: string
  kind: 'delete' | 'patch'
  patch?: Partial<PostModel>
  postId: string
  startedAt: number
}

export interface PostCategoryResourceState {
  categoriesById: Record<string, ResourceCategory>
  categoryIds: string[]
  errorsByPostId: Record<string, unknown>
  listIndexes: Record<string, PostListIndex>
  pendingTransactionIdsByPostId: Record<string, string[]>
  postIdsByCategoryId: Record<string, string[]>
  postsById: Record<string, PostModel>
  transactionsById: Record<string, PostTransaction>
}

interface PostCategoryResourceActions {
  beginPostDeleteTransaction: (postId: string) => string
  beginPostPatchTransaction: (
    postId: string,
    patch: Partial<PostModel>,
  ) => string
  commitPostTransaction: (
    transactionId: string,
    serverPost?: PostModel,
  ) => void
  hydrateCategories: (categories: ResourceCategory[]) => void
  hydrateCategory: (category: ResourceCategory) => void
  hydratePostDetail: (post: PostModel) => void
  hydratePostList: (
    listKey: string,
    result: PaginateResult<PostModel>,
  ) => void
  removeCategory: (categoryId: string) => void
  reset: () => void
  rollbackPostTransaction: (transactionId: string, error?: unknown) => void
}

export type PostCategoryResourceStore = PostCategoryResourceState &
  PostCategoryResourceActions

const initialState: PostCategoryResourceState = {
  categoriesById: {},
  categoryIds: [],
  errorsByPostId: {},
  listIndexes: {},
  pendingTransactionIdsByPostId: {},
  postIdsByCategoryId: {},
  postsById: {},
  transactionsById: {},
}

export const usePostCategoryResourceStore =
  createWithEqualityFn<PostCategoryResourceStore>()(
    (set) => ({
      ...initialState,
      beginPostDeleteTransaction: (postId) => {
        const transactionId = createTransactionId()
        set(
          produce<PostCategoryResourceStore>((draft) => {
            addPostTransaction(draft, {
              id: transactionId,
              kind: 'delete',
              postId,
              startedAt: Date.now(),
            })
            delete draft.errorsByPostId[postId]
            rebuildPostCategoryRelations(draft)
          }),
        )
        return transactionId
      },
      beginPostPatchTransaction: (postId, patch) => {
        const transactionId = createTransactionId()
        set(
          produce<PostCategoryResourceStore>((draft) => {
            addPostTransaction(draft, {
              id: transactionId,
              kind: 'patch',
              patch,
              postId,
              startedAt: Date.now(),
            })
            delete draft.errorsByPostId[postId]
            rebuildPostCategoryRelations(draft)
          }),
        )
        return transactionId
      },
      commitPostTransaction: (transactionId, serverPost) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            const transaction = draft.transactionsById[transactionId]
            if (!transaction) return

            removePostTransaction(draft, transactionId)

            if (transaction.kind === 'delete') {
              delete draft.postsById[transaction.postId]
              delete draft.errorsByPostId[transaction.postId]
            } else if (serverPost) {
              upsertPost(draft, serverPost)
              delete draft.errorsByPostId[serverPost.id]
            }

            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      hydrateCategories: (categories) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            draft.categoryIds = categories.map((category) => category.id)
            for (const category of categories) {
              upsertCategory(draft, category)
            }
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      hydrateCategory: (category) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            upsertCategory(draft, category)
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      hydratePostDetail: (post) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            upsertPost(draft, post)
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      hydratePostList: (listKey, result) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            for (const post of result.data) {
              upsertPost(draft, post)
            }
            draft.listIndexes[listKey] = {
              ids: result.data.map((post) => post.id),
              pagination: result.pagination,
              updatedAt: Date.now(),
            }
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      removeCategory: (categoryId) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            delete draft.categoriesById[categoryId]
            draft.categoryIds = draft.categoryIds.filter(
              (id) => id !== categoryId,
            )
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
      reset: () => set({ ...initialState }),
      rollbackPostTransaction: (transactionId, error) => {
        set(
          produce<PostCategoryResourceStore>((draft) => {
            const transaction = draft.transactionsById[transactionId]
            if (!transaction) return

            removePostTransaction(draft, transactionId)
            if (error) draft.errorsByPostId[transaction.postId] = error
            rebuildPostCategoryRelations(draft)
          }),
        )
      },
    }),
    shallow,
  )

export function serializeResourceListKey(queryKey: readonly unknown[]) {
  return JSON.stringify(queryKey)
}

export function selectPostList(
  state: PostCategoryResourceState,
  listKey: string,
) {
  const index = state.listIndexes[listKey]
  if (!index) {
    return {
      pagination: undefined,
      posts: [] as PostModel[],
      updatedAt: 0,
    }
  }

  return {
    pagination: index.pagination,
    posts: index.ids
      .map((id) => selectVisiblePost(state, id))
      .filter((post): post is PostModel => Boolean(post)),
    updatedAt: index.updatedAt,
  }
}

export function selectPostCategories(state: PostCategoryResourceState) {
  return state.categoryIds
    .map((id) => state.categoriesById[id])
    .filter((category): category is ResourceCategory => Boolean(category))
}

export function selectPostCategory(
  state: PostCategoryResourceState,
  categoryId: string,
) {
  return state.categoriesById[categoryId]
}

export function selectVisiblePost(
  state: PostCategoryResourceState,
  postId: string,
) {
  const base = state.postsById[postId]
  if (!base) return

  let visible: PostModel | undefined = base
  const transactionIds = state.pendingTransactionIdsByPostId[postId] ?? []

  for (const transactionId of transactionIds) {
    const transaction = state.transactionsById[transactionId]
    if (!transaction) continue
    if (transaction.kind === 'delete') {
      visible = undefined
      break
    }
    visible = {
      ...visible,
      ...transaction.patch,
    }
  }

  if (!visible) return
  return attachCategory(state, visible)
}

export function resetPostCategoryResourceStoreForTest() {
  usePostCategoryResourceStore.getState().reset()
}

function addPostTransaction(
  draft: PostCategoryResourceStore,
  transaction: PostTransaction,
) {
  draft.transactionsById[transaction.id] = transaction
  const ids = draft.pendingTransactionIdsByPostId[transaction.postId] ?? []
  draft.pendingTransactionIdsByPostId[transaction.postId] = [
    ...ids,
    transaction.id,
  ]
}

function removePostTransaction(
  draft: PostCategoryResourceStore,
  transactionId: string,
) {
  const transaction = draft.transactionsById[transactionId]
  if (!transaction) return

  delete draft.transactionsById[transactionId]
  const nextIds = (
    draft.pendingTransactionIdsByPostId[transaction.postId] ?? []
  ).filter((id) => id !== transactionId)

  if (nextIds.length === 0) {
    delete draft.pendingTransactionIdsByPostId[transaction.postId]
  } else {
    draft.pendingTransactionIdsByPostId[transaction.postId] = nextIds
  }
}

function upsertPost(draft: PostCategoryResourceStore, post: PostModel) {
  if (post.category) {
    upsertCategory(draft, post.category)
  }
  draft.postsById[post.id] = post
}

function upsertCategory(
  draft: PostCategoryResourceStore,
  category: ResourceCategory,
) {
  draft.categoriesById[category.id] = {
    ...draft.categoriesById[category.id],
    ...category,
  }
  if (!draft.categoryIds.includes(category.id)) {
    draft.categoryIds.push(category.id)
  }
}

function rebuildPostCategoryRelations(draft: PostCategoryResourceStore) {
  const next: Record<string, string[]> = {}

  for (const postId of Object.keys(draft.postsById)) {
    const post = selectVisiblePost(draft, postId)
    if (!post?.categoryId) continue
    next[post.categoryId] = [...(next[post.categoryId] ?? []), postId]
  }

  draft.postIdsByCategoryId = next
}

function attachCategory(
  state: PostCategoryResourceState,
  post: PostModel,
): PostModel {
  const category = state.categoriesById[post.categoryId] ?? post.category
  return {
    ...post,
    category: category as Category,
  }
}

function createTransactionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
