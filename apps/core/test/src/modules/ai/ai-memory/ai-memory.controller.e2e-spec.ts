import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createE2EApp } from '@/helper/create-e2e-app'
import { authPassHeader } from '@/mock/guard/auth.guard'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AiMemoryController } from '~/modules/ai/ai-memory/ai-memory.controller'
import { AiMemoryService } from '~/modules/ai/ai-memory/ai-memory.service'

const baseRow = (overrides: Record<string, unknown> = {}) => ({
  id: '7000000000000000010',
  scope: 'global',
  type: 'fact',
  content: 'be brief',
  confidence: 1,
  salience: 1,
  source: { kind: 'manual', authorId: '1' },
  embedding: null,
  embeddingModel: null,
  dim: null,
  firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: null,
  supersedesId: null,
  status: 'active',
  metadata: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
})

describe('AiMemoryController e2e', () => {
  const mockService = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    getKpi: vi.fn(),
  }

  const proxy = createE2EApp({
    controllers: [AiMemoryController],
    providers: [{ provide: AiMemoryService, useValue: mockService }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /ai-memory returns paginated envelope with snake_case data', async () => {
    mockService.list.mockResolvedValue({
      data: [baseRow()],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/ai-memory?scope=global&page=1&size=20`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0]).toMatchObject({
      id: '7000000000000000010',
      has_embedding: false,
      scope: 'global',
      type: 'fact',
    })
    expect(body.meta?.pagination).toMatchObject({ page: 1, total: 1 })
  })

  it('GET /ai-memory/:id returns detail view', async () => {
    mockService.findById.mockResolvedValue(baseRow())

    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/ai-memory/7000000000000000010`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      id: '7000000000000000010',
      has_embedding: false,
    })
  })

  it('POST /ai-memory accepts CreateMemoryDto and forwards actor id', async () => {
    mockService.create.mockResolvedValue(baseRow({ id: '7000000000000000020' }))

    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai-memory`,
      headers: authPassHeader,
      payload: {
        scope: 'persona:inner-self',
        type: 'preference',
        content: 'sleep early',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'persona:inner-self',
        content: 'sleep early',
      }),
      '1',
    )
  })

  it('POST /ai-memory rejects malformed scope', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai-memory`,
      headers: authPassHeader,
      payload: { scope: 'invalid:Scope', type: 'fact', content: 'x' },
    })

    expect([400, 422]).toContain(res.statusCode)
    expect(mockService.create).not.toHaveBeenCalled()
  })

  it('PUT /ai-memory/:id calls service.update', async () => {
    mockService.update.mockResolvedValue(baseRow({ content: 'updated' }))

    const res = await proxy.app.inject({
      method: 'PUT',
      url: `${apiRoutePrefix}/ai-memory/7000000000000000010`,
      headers: authPassHeader,
      payload: { content: 'updated' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockService.update).toHaveBeenCalledWith(
      '7000000000000000010',
      expect.objectContaining({ content: 'updated' }),
      '1',
    )
  })

  it('DELETE /ai-memory/:id returns 204 and calls archive', async () => {
    mockService.archive.mockResolvedValue(undefined)

    const res = await proxy.app.inject({
      method: 'DELETE',
      url: `${apiRoutePrefix}/ai-memory/7000000000000000010`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(204)
    expect(mockService.archive).toHaveBeenCalledWith('7000000000000000010')
  })

  it('GET /ai-memory/kpi returns counts', async () => {
    mockService.getKpi.mockResolvedValue({ total: 5, active: 3, archived: 2 })

    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/ai-memory/kpi`,
      headers: authPassHeader,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ total: 5, active: 3, archived: 2 })
  })
})
