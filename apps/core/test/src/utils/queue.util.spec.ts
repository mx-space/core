import { AsyncQueue } from '~/utils/queue.util'

describe('AsyncQueue', () => {
  describe('runAll', () => {
    it('should run all tasks with concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5]
      const executionOrder: number[] = []

      const { results, errors } = await AsyncQueue.runAll(
        items,
        async (item) => {
          executionOrder.push(item)
          await new Promise((resolve) => setTimeout(resolve, 10))
          return item * 2
        },
        2,
      )

      expect(results).toEqual([2, 4, 6, 8, 10])
      expect(errors.size).toBe(0)
      expect(executionOrder).toHaveLength(5)
    })

    it('should respect concurrency limit', async () => {
      const items = [1, 2, 3, 4]
      let maxConcurrent = 0
      let currentConcurrent = 0

      await AsyncQueue.runAll(
        items,
        async (item) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          await new Promise((resolve) => setTimeout(resolve, 50))
          currentConcurrent--
          return item
        },
        2,
      )

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('should capture errors without stopping other tasks', async () => {
      const items = [1, 2, 3, 4, 5]

      const { results, errors } = await AsyncQueue.runAll(
        items,
        async (item) => {
          if (item === 3) {
            throw new Error('Task 3 failed')
          }
          return item * 2
        },
        2,
      )

      expect(results[0]).toBe(2)
      expect(results[1]).toBe(4)
      expect(results[2]).toBe(null)
      expect(results[3]).toBe(8)
      expect(results[4]).toBe(10)
      expect(errors.size).toBe(1)
      expect(errors.get(2)?.message).toBe('Task 3 failed')
    })

    it('should handle empty array', async () => {
      const { results, errors } = await AsyncQueue.runAll(
        [],
        async (item: number) => item * 2,
        5,
      )

      expect(results).toEqual([])
      expect(errors.size).toBe(0)
    })

    it('should handle concurrency greater than items length', async () => {
      const items = [1, 2]

      const { results, errors } = await AsyncQueue.runAll(
        items,
        async (item) => item * 2,
        10,
      )

      expect(results).toEqual([2, 4])
      expect(errors.size).toBe(0)
    })

    it('should pass index to callback function', async () => {
      const items = ['a', 'b', 'c']
      const indices: number[] = []

      await AsyncQueue.runAll(
        items,
        async (item, index) => {
          indices.push(index)
          return item
        },
        2,
      )

      expect(indices.sort()).toEqual([0, 1, 2])
    })

    it('should handle all tasks failing', async () => {
      const items = [1, 2, 3]

      const { results, errors } = await AsyncQueue.runAll(
        items,
        async () => {
          throw new Error('All failed')
        },
        2,
      )

      expect(results).toEqual([null, null, null])
      expect(errors.size).toBe(3)
    })
  })
})
