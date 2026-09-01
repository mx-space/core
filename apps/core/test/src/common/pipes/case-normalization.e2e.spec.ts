import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { z } from 'zod'

export const QuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

type QueryDto = z.infer<typeof QuerySchema>

export const BodySchema = z.object({
  newName: z.string(),
  socialIds: z.record(z.string(), z.string()).optional(),
})

type BodyDto = z.infer<typeof BodySchema>

@Controller('case-test')
class CaseTestController {
  @Get('/echo')
  echoQuery(@Query({ schema: QuerySchema }) query: QueryDto) {
    return { sortBy: query.sortBy ?? null, sortOrder: query.sortOrder }
  }

  @Post('/echo')
  echoBody(@Body({ schema: BodySchema }) body: BodyDto) {
    return body
  }
}

describe('request case normalization', () => {
  const proxy = createE2EApp({
    controllers: [CaseTestController],
  })

  test('accepts snake_case query keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/case-test/echo?sort_by=createdAt&sort_order=asc',
    })
    expect(res.statusCode).toBe(200)
    // ResponseInterceptor snake-cases the controller return on the wire
    expect(res.json().data).toEqual({ sort_by: 'createdAt', sort_order: 'asc' })
  })

  test('still accepts camelCase query keys', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: '/case-test/echo?sortBy=title&sortOrder=desc',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ sort_by: 'title', sort_order: 'desc' })
  })

  test('camelizes top-level body keys but leaves freeform JSON intact', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: '/case-test/echo',
      payload: { new_name: 'a', social_ids: { github_user: 'u' } },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toEqual({
      new_name: 'a',
      social_ids: { github_user: 'u' },
    })
  })

  test('validation failure keeps the 422 VALIDATION_FAILED envelope', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: '/case-test/echo',
      payload: {},
    })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.message).toBe(
      'newName: Invalid input: expected string, received undefined',
    )
    expect(body.error.details.errors[0]).toMatchObject({
      field: 'newName',
      path: ['newName'],
      message: expect.stringContaining('expected string'),
    })
    expect(body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['newName'],
          message: expect.any(String),
        }),
      ]),
    )
  })
})
