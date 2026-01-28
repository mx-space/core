export class AsyncQueue {
  private maxConcurrent: number
  private queue: (() => Promise<any>)[]
  private activeCount: number

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent
    this.queue = []
    this.activeCount = 0
  }

  private async runNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    this.activeCount++
    const request = this.queue.shift()!

    try {
      return await request()
    } catch (error) {
      console.error('Request failed', error)
    } finally {
      this.activeCount--
      this.runNext() // Start the next request after this one finishes
    }
  }

  add(request: () => Promise<any>) {
    this.queue.push(request)
    return this.runNext()
  }

  addMultiple(requests: (() => Promise<any>)[]) {
    this.queue.push(...requests)
    const wait = this.runNext()
    return async () => await wait
  }

  /**
   * Run tasks with concurrency limit and wait for all to complete
   * Returns results array and errors map (index -> error)
   */
  static async runAll<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number,
  ): Promise<{ results: (R | null)[]; errors: Map<number, Error> }> {
    const results = Array.from({ length: items.length }).fill(
      null,
    ) as (R | null)[]
    const errors = new Map<number, Error>()
    let currentIndex = 0

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++
        try {
          results[index] = await fn(items[index], index)
        } catch (error) {
          errors.set(index, error as Error)
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    )
    await Promise.all(workers)

    return { results, errors }
  }
}
