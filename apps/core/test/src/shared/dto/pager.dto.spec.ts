import { createPagerSchema } from '~/shared/dto/pager.dto'

describe('createPagerSchema', () => {
  const schema = createPagerSchema(['createdAt', 'title'])

  test('applies defaults when the query is empty', () => {
    expect(schema.parse({})).toMatchObject({
      page: 1,
      size: 10,
      sortOrder: 'desc',
    })
  })

  test('coerces string page and size from the query string', () => {
    const result = schema.parse({ page: '3', size: '25' })

    expect(result.page).toBe(3)
    expect(result.size).toBe(25)
  })

  test('accepts a sortBy key declared in the factory', () => {
    expect(schema.parse({ sortBy: 'title' }).sortBy).toBe('title')
  })

  test('rejects a sortBy key not declared in the factory', () => {
    expect(schema.safeParse({ sortBy: 'slug' }).success).toBe(false)
  })

  test('rejects a size above the 100 cap', () => {
    expect(schema.safeParse({ size: '500' }).success).toBe(false)
  })
})
