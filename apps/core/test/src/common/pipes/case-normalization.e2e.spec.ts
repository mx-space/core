import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { z } from 'zod'

const QuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

class QueryDto extends createZodDto(QuerySchema) {}

const BodySchema = z.object({
  newName: z.string(),
  socialIds: z.record(z.string(), z.string()).optional(),
})

class BodyDto extends createZodDto(BodySchema) {}

@Controller('case-test')
class CaseTestController {
  @Get('/echo')
  echoQuery(@Query() query: QueryDto) {
    return { sortBy: query.sortBy ?? null, sortOrder: query.sortOrder }
  }

  @Post('/echo')
  echoBody(@Body() body: BodyDto) {
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
})
