import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const validEnv = {
  MX_ENCRYPT_KEY: 'ab'.repeat(32),
  JWT_SECRET: 'runtime-jwt-secret-for-testing-1234567890',
}
async function boot(overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env }
  for (const name of [
    'MX_ENCRYPT_KEY',
    'ENCRYPT_KEY',
    'MX_ENCRYPT_ENABLE',
    'ENCRYPT_ENABLE',
    'MX_SECRET_STORAGE_V2',
    'JWT_SECRET',
    'JWTSECRET',
  ])
    delete env[name]
  try {
    return await promisify(execFile)(
      'node_modules/.bin/vite-node',
      [
        '--config',
        'vite.upgrade.config.ts',
        'test/fixtures/read-security-config.ts',
      ],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...env,
          NODE_ENV: 'development',
          SECURITY_CONFIG_TEST_ENV: JSON.stringify(overrides),
        },
      },
    )
  } catch (error) {
    return error as { stdout: string; stderr: string; code: number }
  }
}

it.each([
  { JWT_SECRET: validEnv.JWT_SECRET },
  { ...validEnv, MX_ENCRYPT_KEY: 'old-short-key' },
  { ...validEnv, MX_ENCRYPT_KEY: 'z'.repeat(64) },
  { ...validEnv, JWT_SECRET: 'short-jwt' },
  ...['MX_ENCRYPT_ENABLE', 'ENCRYPT_ENABLE', 'MX_SECRET_STORAGE_V2'].map(
    (flag) => ({ ...validEnv, [flag]: 'false' }),
  ),
])(
  'rejects unsafe runtime settings before application startup %#',
  async (env) => {
    const result = await boot(env)
    expect(result).toHaveProperty('code', 1)
    expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
    expect(result.stderr).not.toContain('old-short-key')
    expect(result.stderr).not.toContain('short-jwt')
  },
  30000,
)

it('starts with only explicit secrets and no encryption mode flags', async () => {
  const result = await boot(validEnv)
  expect(result.stdout, result.stderr).toContain('SECURITY_CONFIG_READY')
})

it('keeps key/JWT aliases and accepts old true flags as deprecated no-ops', async () => {
  const result = await boot({
    ENCRYPT_KEY: validEnv.MX_ENCRYPT_KEY,
    JWTSECRET: validEnv.JWT_SECRET,
    ENCRYPT_ENABLE: 'true',
    MX_SECRET_STORAGE_V2: 'true',
  })
  expect(result.stdout, result.stderr).toContain('SECURITY_CONFIG_READY')
  expect(result.stderr).toContain('deprecated')
})
