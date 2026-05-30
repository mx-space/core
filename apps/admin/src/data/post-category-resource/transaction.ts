import type { PostModel } from '~/models/post'

import { usePostCategoryResourceStore } from './store'

type RemoteRequest<T> = () => Promise<T>
type TransactionFailureHandler = (error: unknown) => Promise<void> | void
type TransactionSuccessHandler<T> = (result: T) => Promise<void> | void

interface PostTransactionOperation {
  postId: string
  transactionId: string
}

export class PostCategoryResourceTransaction<T = unknown> {
  private committed = false
  private failureHandler?: TransactionFailureHandler
  private readonly name: string
  private readonly operations: PostTransactionOperation[] = []
  private requestFn?: RemoteRequest<T>
  private successHandler?: TransactionSuccessHandler<T>

  constructor(name = 'postCategoryResourceTransaction') {
    this.name = name
  }

  deletePost(postId: string) {
    this.assertMutable()
    const transactionId = usePostCategoryResourceStore
      .getState()
      .beginPostDeleteTransaction(postId)

    this.operations.push({ postId, transactionId })
    return this
  }

  patchPost(postId: string, patch: Partial<PostModel>) {
    this.assertMutable()
    const transactionId = usePostCategoryResourceStore
      .getState()
      .beginPostPatchTransaction(postId, patch)

    this.operations.push({ postId, transactionId })
    return this
  }

  set onError(handler: TransactionFailureHandler) {
    this.failureHandler = handler
  }

  set onSuccess(handler: TransactionSuccessHandler<T>) {
    this.successHandler = handler
  }

  set request(request: RemoteRequest<T>) {
    this.requestFn = request
  }

  async commit() {
    if (this.committed) {
      throw new Error(`[PostCategoryResourceTransaction] "${this.name}" already committed`)
    }
    if (!this.requestFn) {
      throw new Error(`[PostCategoryResourceTransaction] "${this.name}" missing request`)
    }

    this.committed = true

    let result: T
    try {
      result = await this.requestFn()
    } catch (error) {
      this.rollback(error)
      await this.failureHandler?.(error)
      throw error
    }

    await this.successHandler?.(result)
    return result
  }

  commitAll() {
    for (const operation of this.operations) {
      this.commitOperation(operation)
    }
  }

  commitPost(postId: string, serverPost?: PostModel) {
    for (const operation of this.operationsForPost(postId)) {
      this.commitOperation(operation, serverPost)
    }
  }

  commitPosts(postIds: Iterable<string>) {
    for (const postId of postIds) {
      this.commitPost(postId)
    }
  }

  rollback(error?: unknown) {
    for (const operation of this.operations) {
      this.rollbackOperation(operation, error)
    }
  }

  rollbackPost(postId: string, error?: unknown) {
    for (const operation of this.operationsForPost(postId)) {
      this.rollbackOperation(operation, error)
    }
  }

  rollbackPosts(postIds: Iterable<string>, error?: unknown) {
    for (const postId of postIds) {
      this.rollbackPost(postId, error)
    }
  }

  private commitOperation(
    operation: PostTransactionOperation,
    serverPost?: PostModel,
  ) {
    usePostCategoryResourceStore
      .getState()
      .commitPostTransaction(operation.transactionId, serverPost)
  }

  private operationsForPost(postId: string) {
    return this.operations.filter((operation) => operation.postId === postId)
  }

  private rollbackOperation(
    operation: PostTransactionOperation,
    error?: unknown,
  ) {
    usePostCategoryResourceStore
      .getState()
      .rollbackPostTransaction(operation.transactionId, error)
  }

  private assertMutable() {
    if (this.committed) {
      throw new Error(`[PostCategoryResourceTransaction] "${this.name}" is already committed`)
    }
  }
}
