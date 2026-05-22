import { z } from 'zod'

import { AppException } from '~/common/errors/exception.types'
import { parseView } from '~/common/views/view.types'

const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  secret: z.string(),
})

const views = {
  card: ResourceSchema.pick({ id: true, title: true }),
  detail: ResourceSchema,
}

describe('parseView', () => {
  test('parses a row through the selected view, dropping unselected fields', () => {
    const result = parseView('card', views, {
      id: '1',
      title: 'Hello',
      secret: 'leaked',
    })

    expect(result).toEqual({ id: '1', title: 'Hello' })
  })

  test('returns the full row for a full-schema view', () => {
    const result = parseView('detail', views, {
      id: '1',
      title: 'Hello',
      secret: 'kept',
    })

    expect(result).toEqual({ id: '1', title: 'Hello', secret: 'kept' })
  })

  test('throws an INVALID_VIEW AppException for an unknown view name', () => {
    let caught: unknown
    try {
      parseView('nope', views, { id: '1', title: 'Hello', secret: 'x' })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AppException)
    expect((caught as AppException).code).toBe('INVALID_VIEW')
    expect((caught as AppException).getStatus()).toBe(400)
  })

  test('throws when the row fails the view schema', () => {
    expect(() => parseView('card', views, { id: '1' })).toThrow()
  })
})
