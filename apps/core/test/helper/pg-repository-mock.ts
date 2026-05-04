import { vi } from 'vitest'

export type MockedRepository<T extends object> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : T[K]
}

export const createPgRepositoryMock = <T extends object>(
  methods: Partial<MockedRepository<T>> = {},
): MockedRepository<T> => {
  return new Proxy(methods as MockedRepository<T>, {
    get(target, prop: string) {
      if (!(prop in target)) {
        ;(target as any)[prop] = vi.fn()
      }
      return (target as any)[prop]
    },
  })
}

export const now = new Date('2026-01-01T00:00:00.000Z')
