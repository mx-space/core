const TEST_DATABASE_MARKER = /(?:^|_)(?:test|verify|e2e|isolated|iso)(?:_|$)/i

export function assertSafeTestDatabaseName(databaseName: string): void {
  if (TEST_DATABASE_MARKER.test(databaseName)) {
    return
  }

  throw new Error(
    `Refusing to run destructive PostgreSQL tests against database "${databaseName}". ` +
      'Use a dedicated database whose name contains a test marker such as "test", "verify", "e2e", "isolated", or "iso".',
  )
}

export function assertSafeTestDatabaseUrl(connectionUri: string): void {
  const url = new URL(connectionUri)
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

  if (!databaseName) {
    throw new Error(
      'Refusing to run destructive PostgreSQL tests without an explicit database name in PG_VERIFY_URL.',
    )
  }

  assertSafeTestDatabaseName(databaseName)
}
