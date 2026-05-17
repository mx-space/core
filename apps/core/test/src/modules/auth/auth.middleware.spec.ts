import type { IncomingMessage, ServerResponse } from 'node:http'

import { vi } from 'vitest'

import {
  AuthMiddleware,
  shouldBypassBetterAuth,
} from '~/modules/auth/auth.middleware'

function createMiddleware(handler?: any) {
  const middleware = Object.create(AuthMiddleware.prototype) as AuthMiddleware
  ;(middleware as any).authHandler = handler ?? null
  ;(middleware as any).ensureAuthHandlerFresh = vi
    .fn()
    .mockResolvedValue(undefined)
  return middleware
}

function createReqRes(overrides?: { url?: string; method?: string }) {
  const req = {
    originalUrl: overrides?.url ?? '/api/auth/sign-in',
    method: overrides?.method ?? 'POST',
  } as IncomingMessage
  const res = {} as ServerResponse
  const next = vi.fn()
  return { req, res, next }
}

describe('AuthMiddleware', () => {
  describe('use()', () => {
    it('should call next when authHandler is not set', async () => {
      const middleware = createMiddleware(null)
      const { req, res, next } = createReqRes()

      await middleware.use(req, res, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('should bypass /token path', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({ url: '/api/auth/token' })

      await middleware.use(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should bypass /session path', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({ url: '/api/auth/session' })

      await middleware.use(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should bypass /providers path', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({ url: '/api/auth/providers' })

      await middleware.use(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should bypass non-GET/POST methods', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)

      for (const method of ['DELETE', 'PUT', 'PATCH', 'OPTIONS']) {
        const { req, res, next } = createReqRes({
          url: '/api/auth/sign-in',
          method,
        })
        await middleware.use(req, res, next)
        expect(next).toHaveBeenCalled()
        expect(handler).not.toHaveBeenCalled()
      }
    })

    it('should call authHandler for GET requests to non-bypass paths', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({
        url: '/api/auth/sign-in',
        method: 'GET',
      })

      await middleware.use(req, res, next)

      expect((middleware as any).ensureAuthHandlerFresh).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(req, res)
      expect(next).not.toHaveBeenCalled()
    })

    it('should call authHandler for POST requests to non-bypass paths', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({
        url: '/api/auth/sign-in',
        method: 'POST',
      })

      await middleware.use(req, res, next)

      expect((middleware as any).ensureAuthHandlerFresh).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(req, res)
      expect(next).not.toHaveBeenCalled()
    })

    it('should call authHandler for callback paths', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({
        url: '/api/auth/callback/github',
        method: 'GET',
      })

      await middleware.use(req, res, next)

      expect((middleware as any).ensureAuthHandlerFresh).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(req, res)
      expect(next).not.toHaveBeenCalled()
    })

    it('should call authHandler when token is nested under device auth', async () => {
      const handler = vi.fn()
      const middleware = createMiddleware(handler)
      const { req, res, next } = createReqRes({
        url: '/auth/device/token',
        method: 'POST',
      })

      await middleware.use(req, res, next)

      expect((middleware as any).ensureAuthHandlerFresh).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(req, res)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('shouldBypassBetterAuth()', () => {
    it('matches only local auth controller endpoints', () => {
      expect(shouldBypassBetterAuth('/auth/token')).toBe(true)
      expect(shouldBypassBetterAuth('/auth/session?x=1')).toBe(true)
      expect(shouldBypassBetterAuth('/api/v2/auth/providers/')).toBe(true)

      expect(shouldBypassBetterAuth('/auth/device/token')).toBe(false)
      expect(shouldBypassBetterAuth('/api/v2/auth/device/token')).toBe(false)
      expect(shouldBypassBetterAuth('/api/auth/session/refresh')).toBe(false)
    })
  })
})
