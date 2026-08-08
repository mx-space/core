import {
  assertSafeTestDatabaseName,
  assertSafeTestDatabaseUrl,
} from 'test/helper/pg-test-database-safety'

describe('PostgreSQL test database safety', () => {
  it.each(['mx_core', 'production', 'content'])(
    'rejects a non-test database named %s',
    (databaseName) => {
      expect(() => assertSafeTestDatabaseName(databaseName)).toThrow(
        'Refusing to run destructive PostgreSQL tests',
      )
    },
  )

  it.each([
    'mx_verify',
    'mx_core_test',
    'mx_core_e2e',
    'mx_isolated_123',
    'mx_iso_123',
  ])('accepts a dedicated test database named %s', (databaseName) => {
    expect(() => assertSafeTestDatabaseName(databaseName)).not.toThrow()
  })

  it('rejects the development database when supplied through PG_VERIFY_URL', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgres://mx:mx@127.0.0.1:5433/mx_core'),
    ).toThrow('database "mx_core"')
  })

  it('requires PG_VERIFY_URL to name a database explicitly', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgres://mx:mx@127.0.0.1:5433'),
    ).toThrow('without an explicit database name')
  })
})
