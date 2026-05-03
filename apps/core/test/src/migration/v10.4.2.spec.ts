import { describe, expect, it } from 'vitest'

import { db } from '~/processors/database/postgres.provider'

describe('legacy v10.4.2 migration boundary', () => {
  it('fails fast when repository code accesses PG before provider initialization', () => {
    expect(() => Reflect.get(db, 'select')).toThrow(
      'PostgreSQL db requested before initialization',
    )
  })
})
