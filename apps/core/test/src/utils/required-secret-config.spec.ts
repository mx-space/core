import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const validEnv = {
  MX_ENCRYPT_KEY: 'ab'.repeat(32),
  JWT_SECRET: 'runtime-jwt-secret-for-testing-1234567890',
}
const coreCwd = fileURLToPath(new URL('../../../', import.meta.url))
async function boot(overrides: NodeJS.ProcessEnv = {}, args: string[] = []) {
  const env = { ...process.env }
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
        cwd: coreCwd,
        env: {
          ...env,
          NODE_ENV: 'production',
          SECURITY_CONFIG_TEST_ENV: JSON.stringify(overrides),
          SECURITY_CONFIG_TEST_ARGS: JSON.stringify(args),
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

it.each(['', 'aes-256-ecb', 'aes-256-gcm'])(
  'rejects the removed algorithm environment option even when its value is %j',
  async (algorithm) => {
    const result = await boot({ ...validEnv, ENCRYPT_ALGORITHM: algorithm })
    expect(result).toHaveProperty('code', 1)
    expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
    expect(result.stderr).toContain('ENCRYPT_ALGORITHM')
  },
)

it('rejects the removed algorithm command-line option', async () => {
  const result = await boot(validEnv, ['--encrypt_algorithm', 'aes-256-ecb'])
  expect(result).toHaveProperty('code', 1)
  expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
})

it('rejects the removed algorithm YAML option', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mx-algorithm-config-'))
  try {
    const file = join(directory, 'config.yml')
    await writeFile(file, 'encrypt_algorithm: aes-256-ecb\n')
    const result = await boot(validEnv, ['--config', relative(coreCwd, file)])
    expect(result).toHaveProperty('code', 1)
    expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
    expect(result.stderr).toContain('encrypt_algorithm')
  } finally {
    await rm(directory, { recursive: true })
  }
})

it('persists a private development key and decrypts data across concurrent boots and restarts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mx-dev-security-'))
  const env = {
    NODE_ENV: 'development',
    JWT_SECRET: validEnv.JWT_SECRET,
    SECURITY_CONFIG_TEST_CWD: directory,
  }
  try {
    const results = await Promise.all([boot(env), boot(env)])
    for (const result of results)
      expect(result.stdout, result.stderr).toContain('SECURITY_CONFIG_READY')
    const keyFile = join(directory, 'tmp', 'dev-encryption.key')
    const key = (await readFile(keyFile, 'utf8')).trim()
    expect(key).toMatch(/^[\da-f]{64}$/i)
    expect((await stat(keyFile)).mode & 0o777).toBe(0o600)
    expect(await readdir(join(directory, 'tmp'))).toEqual([
      'dev-encryption.key',
    ])
    const first = JSON.parse(results[0].stdout.split('\n')[1])
    const restarted = await boot({
      ...env,
      SECURITY_CONFIG_TEST_CIPHERTEXT: first.encrypted,
    })
    expect(JSON.parse(restarted.stdout.split('\n')[1])).toEqual({
      encrypted: first.encrypted,
      decrypted: 'fixture-secret',
    })
    expect(await readFile(keyFile, 'utf8')).toBe(key)
  } finally {
    await rm(directory, { recursive: true })
  }
}, 30000)

it('preserves an explicit development key without creating or replacing a local key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mx-explicit-security-'))
  try {
    const result = await boot({
      ...validEnv,
      NODE_ENV: 'development',
      SECURITY_CONFIG_TEST_CWD: directory,
    })
    expect(result.stdout, result.stderr).toContain('SECURITY_CONFIG_READY')
    expect(await readdir(directory)).toEqual([])
  } finally {
    await rm(directory, { recursive: true })
  }
})

it.each(['production', 'test', 'staging'])(
  'never generates a field key outside development (%s)',
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), 'mx-strict-security-'))
    try {
      const result = await boot({
        NODE_ENV: mode,
        JWT_SECRET: validEnv.JWT_SECRET,
        SECURITY_CONFIG_TEST_CWD: directory,
      })
      expect(result).toHaveProperty('code', 1)
      expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
      expect(await readdir(directory)).toEqual([])
    } finally {
      await rm(directory, { recursive: true })
    }
  },
)

it.each(['local', 'explicit'])(
  'refuses an invalid %s development key without replacing persisted secrets',
  async (source) => {
    const directory = await mkdtemp(join(tmpdir(), 'mx-invalid-dev-security-'))
    const persisted =
      source === 'local' ? 'invalid-local-key' : validEnv.MX_ENCRYPT_KEY
    try {
      await mkdir(join(directory, 'tmp'))
      const keyFile = join(directory, 'tmp', 'dev-encryption.key')
      await writeFile(keyFile, persisted)
      const result = await boot({
        NODE_ENV: 'development',
        JWT_SECRET: validEnv.JWT_SECRET,
        ...(source === 'explicit'
          ? { MX_ENCRYPT_KEY: 'invalid-explicit-key' }
          : {}),
        SECURITY_CONFIG_TEST_CWD: directory,
      })
      expect(result).toHaveProperty('code', 1)
      expect(result.stdout).not.toContain('SECURITY_CONFIG_READY')
      expect(result.stderr).not.toContain('invalid-local-key')
      expect(result.stderr).not.toContain('invalid-explicit-key')
      expect(await readFile(keyFile, 'utf8')).toBe(persisted)
      expect(await readdir(join(directory, 'tmp'))).toEqual([
        'dev-encryption.key',
      ])
    } finally {
      await rm(directory, { recursive: true })
    }
  },
)

const builtEntry = fileURLToPath(
  new URL('../../../out/main.mjs', import.meta.url),
)
it.skipIf(!existsSync(builtEntry))(
  'keeps release builds strict even with NODE_ENV=development and a local development key',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mx-built-security-'))
    try {
      await mkdir(join(directory, 'tmp'))
      const keyFile = join(directory, 'tmp', 'dev-encryption.key')
      await writeFile(keyFile, validEnv.MX_ENCRYPT_KEY)
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: 'development',
        JWT_SECRET: validEnv.JWT_SECRET,
      }
      delete env.MX_ENCRYPT_KEY
      delete env.ENCRYPT_KEY
      const result = await promisify(execFile)('node', [builtEntry], {
        cwd: directory,
        env,
      }).catch(
        (error) => error as { code: number; stdout: string; stderr: string },
      )
      expect(result).toHaveProperty('code', 1)
      expect(result.stderr).toContain('Encryption requires an explicit')
      expect(await readFile(keyFile, 'utf8')).toBe(validEnv.MX_ENCRYPT_KEY)
    } finally {
      await rm(directory, { recursive: true })
    }
  },
)
