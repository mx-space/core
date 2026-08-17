import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildOpenApiDocument } from '~/common/openapi/build-document'
import type { OpenApiRoute } from '~/common/openapi/openapi.types'
import { routeManifest } from '~/common/openapi/route-manifest'

const build = (routes: OpenApiRoute[]) => buildOpenApiDocument(routes, 3)

const baseRoute: OpenApiRoute = {
  operationId: 'listThings',
  method: 'get',
  path: '/things',
  tag: 'things',
  summary: 'List things',
  auth: true,
}

describe('buildOpenApiDocument', () => {
  it('snake-cases response properties to match the wire format', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({ createdAt: z.string(), refType: z.string() }),
        },
      },
    ])

    expect(document.components.schemas.Thing).toMatchObject({
      properties: {
        created_at: { type: 'string' },
        ref_type: { type: 'string' },
      },
      required: ['created_at', 'ref_type'],
    })
  })

  it('leaves request bodies camelCase so nested keys survive the pipe', () => {
    const { document } = build([
      {
        ...baseRoute,
        method: 'post',
        operationId: 'createThing',
        body: {
          name: 'ThingCreate',
          schema: z.object({ refId: z.string() }),
        },
      },
    ])

    expect(document.components.schemas.ThingCreate).toMatchObject({
      properties: { refId: { type: 'string' } },
    })
  })

  it('wraps enveloped responses in { data, meta } and arrays in items', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: { name: 'Thing', schema: z.object({ id: z.string() }) },
        responseIsArray: true,
      },
    ])

    const schema = (document.paths['/things'].get as any).responses['200']
      .content['application/json'].schema

    expect(schema).toEqual({
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Thing' },
        },
        meta: { $ref: '#/components/schemas/ResponseMeta' },
      },
    })
  })

  it('emits raw bodies for routes that bypass the response interceptor', () => {
    const { document } = build([
      {
        ...baseRoute,
        envelope: false,
        response: { name: 'Thing', schema: z.object({ id: z.string() }) },
      },
    ])

    const schema = (document.paths['/things'].get as any).responses['200']
      .content['application/json'].schema

    expect(schema).toEqual({ $ref: '#/components/schemas/Thing' })
  })

  it('templates path params and snake-cases their names', () => {
    const { document } = build([
      {
        ...baseRoute,
        operationId: 'getThread',
        path: '/comments/thread/:rootCommentId',
        params: z.object({ rootCommentId: z.string() }),
      },
    ])

    const operation = document.paths['/comments/thread/{root_comment_id}']
      .get as any

    expect(operation.parameters).toEqual([
      {
        name: 'root_comment_id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    ])
  })

  it('renders dates as date-time strings instead of throwing', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: { name: 'Thing', schema: z.object({ createdAt: z.date() }) },
      },
    ])

    expect(document.components.schemas.Thing).toMatchObject({
      properties: { created_at: { type: 'string', format: 'date-time' } },
    })
  })

  it('folds nullable unions into optional fields', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({
            id: z.string(),
            author: z.string().nullable(),
            note: z.string().nullable().optional(),
          }),
        },
      },
    ])

    expect(document.components.schemas.Thing).toMatchObject({
      properties: {
        id: { type: 'string' },
        author: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['id'],
    })
  })

  it('collapses a date-or-string union into a single date-time string', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({ createdAt: z.date().or(z.string()) }),
        },
      },
    ])

    expect(document.components.schemas.Thing).toMatchObject({
      properties: { created_at: { type: 'string', format: 'date-time' } },
    })
  })

  it('keeps genuinely heterogeneous unions intact', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({ value: z.union([z.string(), z.number()]) }),
        },
      },
    ])

    const value = (document.components.schemas.Thing as any).properties.value
    expect(value.anyOf).toEqual([{ type: 'string' }, { type: 'number' }])
  })

  it('folds nullability inside arrays', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({
            items: z.array(z.object({ tag: z.string().nullable() })),
          }),
        },
      },
    ])

    const items = (document.components.schemas.Thing as any).properties.items
    expect(items.items).toMatchObject({
      properties: { tag: { type: 'string' } },
    })
    expect(items.items.required ?? []).toEqual([])
  })

  it('reports operations whose response carries no field information', () => {
    const { untypedOperations } = build([
      {
        ...baseRoute,
        response: { name: 'Thing', schema: z.object({}).passthrough() },
      },
    ])

    expect(untypedOperations).toEqual(['listThings'])
  })

  it('rejects a component name bound to two different schemas', () => {
    expect(() =>
      build([
        {
          ...baseRoute,
          response: { name: 'Thing', schema: z.object({ id: z.string() }) },
        },
        {
          ...baseRoute,
          operationId: 'getThing',
          path: '/things/:id',
          response: { name: 'Thing', schema: z.object({ id: z.number() }) },
        },
      ]),
    ).toThrow(/reused for two different schemas/)
  })

  it('distinguishes integers from floats so the client gets Int, not Double', () => {
    const { document } = build([
      {
        ...baseRoute,
        response: {
          name: 'Thing',
          schema: z.object({ count: z.number().int(), ratio: z.number() }),
        },
      },
    ])

    expect(document.components.schemas.Thing).toMatchObject({
      properties: {
        count: { type: 'integer' },
        ratio: { type: 'number' },
      },
    })
  })

  it('leaves no v1 operation without a typed response', () => {
    const { untypedOperations } = buildOpenApiDocument(routeManifest, 3)
    expect(untypedOperations).toEqual([])
  })

  it('documents the status the handler actually answers with', () => {
    const { document } = build([
      {
        ...baseRoute,
        method: 'post',
        operationId: 'createThing',
        successStatus: 201,
        response: { name: 'Thing', schema: z.object({ id: z.string() }) },
      },
    ])

    const responses = (document.paths['/things'].post as any).responses
    expect(Object.keys(responses)).toContain('201')
    expect(responses['200']).toBeUndefined()
  })

  it('rejects duplicate operation ids', () => {
    expect(() => build([baseRoute, { ...baseRoute, path: '/other' }])).toThrow(
      /duplicate operationId/,
    )
  })
})

describe('push notification routes', () => {
  const pushRoutes = routeManifest.filter((route) =>
    route.path.startsWith('/notifications/push'),
  )

  it('documents activation as the only push route, and as a public one', () => {
    expect(pushRoutes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'post /notifications/push/activate',
    ])
    expect(pushRoutes[0]!.auth).toBe(false)
  })
})
