// Resolve Vite dependencies from the project, then isolate runtime storage and
// credentials from its local .env before importing application configuration.
for (const name of [
  'MX_ENCRYPT_KEY',
  'ENCRYPT_KEY',
  'MX_ENCRYPT_ENABLE',
  'ENCRYPT_ENABLE',
  'MX_SECRET_STORAGE_V2',
  'ENCRYPT_ALGORITHM',
  'JWT_SECRET',
  'JWTSECRET',
])
  delete process.env[name]
Object.assign(process.env, JSON.parse(process.env.DEV_MIGRATION_TEST_ENV!))
process.chdir(process.env.SECURITY_CONFIG_TEST_CWD!)
process.argv.splice(2)
const { runAppMigrations } = await import('../../src/app-migrate')
await runAppMigrations()
process.exit(0)
