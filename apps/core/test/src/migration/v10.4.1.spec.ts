import { describe, expect, it } from 'vitest'

import { postgresProviders } from '~/processors/database/postgres.provider'

describe('legacy v10.4.1 migration boundary', () => {
  it('keeps the runtime on PostgreSQL providers after removing legacy migration modules', () => {
    expect(postgresProviders.map((provider) => provider.provide)).toEqual(
      expect.arrayContaining(['__pg_pool_token__', '__pg_db_token__']),
    )
  })
})
