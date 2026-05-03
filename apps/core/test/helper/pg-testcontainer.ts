import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer | undefined

export async function startPgTestContainer() {
  if (container) {
    return container
  }

  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('mx_verify')
    .withUsername('mx')
    .withPassword('mx')
    .start()

  const connectionUri = container.getConnectionUri()
  process.env.PG_URL = connectionUri
  process.env.PG_CONNECTION_STRING = connectionUri
  process.env.PG_VERIFY_URL = connectionUri
  process.env.POSTGRES_URL = connectionUri

  return container
}

export async function stopPgTestContainer() {
  if (!container) {
    return
  }

  await container.stop()
  container = undefined
}
