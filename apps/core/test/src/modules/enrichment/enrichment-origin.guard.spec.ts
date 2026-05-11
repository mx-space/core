import type { ExecutionContext } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { vi } from 'vitest'

import { EnrichmentOriginGuard } from '~/modules/enrichment/enrichment-origin.guard'

interface MockRequest {
  user?: unknown
  headers: Record<string, string | undefined>
}

function createMockContext(req: MockRequest) {
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext
  return { context, request: req }
}

function buildGuard(urlConfig: { webUrl?: string; adminUrl?: string } | null) {
  const configsService = {
    get: vi.fn().mockImplementation(async (key: string) => {
      if (key === 'url') return urlConfig ?? {}
      return undefined
    }),
  }
  return {
    guard: new EnrichmentOriginGuard(configsService as any),
    configsService,
  }
}

describe('EnrichmentOriginGuard', () => {
  const webUrl = 'https://blog.example.com'
  const adminUrl = 'https://admin.example.com/dashboard'

  it('bypasses check when request is authenticated', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      user: { id: 'u1' },
      headers: {},
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('allows Origin matching webUrl', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { origin: 'https://blog.example.com' },
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('allows Origin matching adminUrl (path stripped)', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { origin: 'https://admin.example.com' },
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('falls back to Referer when Origin is missing', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { referer: 'https://blog.example.com/posts/abc' },
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('rejects when both Origin and Referer are missing', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({ headers: {} })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects when Origin is from a different host', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { origin: 'https://attacker.example' },
    })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects unparsable Origin', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { origin: 'not a url' },
    })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects unparsable Referer when Origin missing', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      headers: { referer: 'totally bogus' },
    })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects all anonymous when both webUrl and adminUrl are empty', async () => {
    const { guard } = buildGuard({ webUrl: '', adminUrl: '' })
    const { context } = createMockContext({
      headers: { origin: 'https://blog.example.com' },
    })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('rejects when url config is missing entirely', async () => {
    const { guard } = buildGuard(null)
    const { context } = createMockContext({
      headers: { origin: 'https://blog.example.com' },
    })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('normalizes configured URL with trailing slash and path', async () => {
    const { guard } = buildGuard({
      webUrl: 'https://blog.example.com/',
      adminUrl: 'https://admin.example.com/dashboard/',
    })
    const { context } = createMockContext({
      headers: { origin: 'https://blog.example.com' },
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it('still bypasses authenticated requests when headers are forbidden', async () => {
    const { guard } = buildGuard({ webUrl, adminUrl })
    const { context } = createMockContext({
      user: { id: 'admin' },
      headers: { origin: 'https://attacker.example' },
    })
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })
})
