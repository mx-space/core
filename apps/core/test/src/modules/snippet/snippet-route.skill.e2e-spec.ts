import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { describe, expect, it, vi } from 'vitest'

import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetType } from '~/modules/snippet/snippet.schema'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { SnippetRouteController } from '~/modules/snippet/snippet-route.controller'

const SKILL_RAW = `---
name: test-skill
description: A test skill
version: 1.0.0
---

# Test Skill

This is a test skill snippet.`

const publicSkillRow = {
  id: '1',
  type: SnippetType.Skill,
  private: false,
  raw: SKILL_RAW,
  name: 'test-skill',
  reference: 'root',
  comment: null,
  metatype: null,
  schema: null,
  method: null,
  customPath: 'sk/public',
  secret: null,
  enable: true,
  builtIn: false,
  compiledCode: null,
  createdAt: new Date(),
  updatedAt: null,
}

const privateSkillRow = {
  ...publicSkillRow,
  id: '2',
  private: true,
  customPath: 'sk/private',
}

const cachedSkillRow = {
  ...publicSkillRow,
  id: '3',
  customPath: 'sk/cached',
}

const snippetService = {
  getSnippetByCustomPath: vi.fn().mockImplementation(async (path: string) => {
    if (path === 'sk/public') return publicSkillRow
    if (path === 'sk/private') return privateSkillRow
    if (path === 'sk/cached') return cachedSkillRow
    return null
  }),
  getFunctionSnippetByCustomPath: vi.fn().mockResolvedValue(null),
  getFunctionSnippetByCustomPathPrefix: vi.fn().mockResolvedValue(null),
  getCachedSnippetByCustomPath: vi
    .fn()
    .mockImplementation(async (path: string, type: 'public' | 'private') => {
      if (path === 'sk/cached' && type === 'public') return SKILL_RAW
      return null
    }),
  attachSnippet: vi
    .fn()
    .mockImplementation(async (row: any) => ({ ...row, data: row.raw })),
  cacheSnippetByCustomPath: vi.fn().mockResolvedValue(undefined),
}

const proxy = createE2EApp({
  controllers: [SnippetRouteController],
  providers: [
    { provide: SnippetService, useValue: snippetService },
    {
      provide: ServerlessService,
      useValue: { injectContextIntoServerlessFunctionAndCall: vi.fn() },
    },
  ],
})

describe('SnippetRouteController — Skill type', () => {
  it('returns text/markdown with cache headers for a public Skill snippet', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/s/sk/public',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/markdown/)
    expect(res.headers['content-type']).toContain('charset=utf-8')
    expect(res.headers['cache-control']).toBe(
      'public, max-age=300, stale-while-revalidate=3600',
    )
    expect(res.body).toBe(SKILL_RAW)
  })

  it('returns 403 for unauthenticated request to a private Skill snippet', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/s/sk/private',
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns 200 with Skill headers for admin access to a private Skill snippet', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/s/sk/private',
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/markdown/)
    expect(res.headers['content-type']).toContain('charset=utf-8')
    expect(res.headers['cache-control']).toBe(
      'public, max-age=300, stale-while-revalidate=3600',
    )
    expect(res.body).toBe(SKILL_RAW)
  })

  it('returns Skill headers from the redis-cached path', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/s/sk/cached',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/markdown/)
    expect(res.headers['content-type']).toContain('charset=utf-8')
    expect(res.headers['cache-control']).toBe(
      'public, max-age=300, stale-while-revalidate=3600',
    )
    expect(res.body).toBe(SKILL_RAW)
  })
})
