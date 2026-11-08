// Vite loads local .env files before running the entry. Isolate each boot case
// from developer credentials and the test runner's fixture environment.
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
Object.assign(process.env, JSON.parse(process.env.SECURITY_CONFIG_TEST_ENV!))
process.argv.splice(
  2,
  process.argv.length - 2,
  ...JSON.parse(process.env.SECURITY_CONFIG_TEST_ARGS || '[]'),
)
await import('../../src/app.config')

process.stdout.write('SECURITY_CONFIG_READY')
