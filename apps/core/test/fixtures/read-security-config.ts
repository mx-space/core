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
if (process.env.SECURITY_CONFIG_TEST_CWD)
  process.chdir(process.env.SECURITY_CONFIG_TEST_CWD)
const { ENCRYPT } = await import('../../src/app.config')
const { SecretCodec } = await import('../../src/utils/secret-codec')
const codec = new SecretCodec(ENCRYPT)
const encrypted =
  process.env.SECURITY_CONFIG_TEST_CIPHERTEXT ||
  codec.encrypt('fixture-secret', 'fixture.field')

process.stdout.write(
  `SECURITY_CONFIG_READY\n${JSON.stringify({ encrypted, decrypted: codec.decrypt(encrypted, 'fixture.field') })}`,
)
