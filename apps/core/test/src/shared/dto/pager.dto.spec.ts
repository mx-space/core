import { createPagerSchema } from '~/shared/dto/pager.dto'

describe('createPagerSchema', () => {
  const schema = createPagerSchema(['created_at', 'title'])

  test('applies defaults when the query is empty', () => {
    expect(schema.parse({})).toMatchObject({
      page: 1,
      size: 10,
      sort_order: 'desc',
    })
  })

  test('coerces string page and size from the query string', () => {
    const result = schema.parse({ page: '3', size: '25' })

    expect(result.page).toBe(3)
    expect(result.size).toBe(25)
  })

  test('accepts a sort_by key declared in the factory', () => {
    expect(schema.parse({ sort_by: 'title' }).sort_by).toBe('title')
  })

  test('rejects a sort_by key not declared in the factory', () => {
    expect(schema.safeParse({ sort_by: 'slug' }).success).toBe(false)
  })

  test('rejects a size above the 100 cap', () => {
    expect(schema.safeParse({ size: '500' }).success).toBe(false)
  })
})
