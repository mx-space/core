import { describe, expect, it } from 'vitest'

import { createAbortError, throwIfAborted } from '~/utils/abort.util'

describe('ai.util', () => {
  describe('createAbortError', () => {
    it('should create error with name AbortError', () => {
      const err = createAbortError()
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('AbortError')
      expect(err.message).toBe('Task aborted')
    })

    it('should accept custom message', () => {
      const err = createAbortError('custom msg')
      expect(err.message).toBe('custom msg')
      expect(err.name).toBe('AbortError')
    })
  })

  describe('throwIfAborted', () => {
    it('should not throw when signal is undefined', () => {
      expect(() => throwIfAborted(undefined)).not.toThrow()
    })

    it('should not throw when signal is not aborted', () => {
      const controller = new AbortController()
      expect(() => throwIfAborted(controller.signal)).not.toThrow()
    })

    it('should throw AbortError when signal is aborted', () => {
      const controller = new AbortController()
      controller.abort()
      expect(() => throwIfAborted(controller.signal)).toThrowError(
        'Task aborted',
      )
      try {
        throwIfAborted(controller.signal)
      } catch (err: any) {
        expect(err.name).toBe('AbortError')
      }
    })
  })
})
