import { AsyncLocalStorage } from 'node:async_hooks'

export class OperationContext {
  private static readonly storage = new AsyncLocalStorage<string>()

  static run<T>(operationId: string, callback: () => T): T {
    return OperationContext.storage.run(operationId, callback)
  }

  static currentId(): string | undefined {
    return OperationContext.storage.getStore()
  }
}
