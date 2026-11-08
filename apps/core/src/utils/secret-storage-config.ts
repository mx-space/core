export interface SecretStorageConfig {
  key: string
  jwtSecret: string
  /** Used only when reading historical ECB ciphertext. */
  algorithm?: string
  deprecatedFlags?: Record<string, unknown>
}

export function secretStorageConfigFromEnv(
  env: NodeJS.ProcessEnv,
): SecretStorageConfig {
  return {
    key: env.MX_ENCRYPT_KEY || env.ENCRYPT_KEY || '',
    jwtSecret: env.JWT_SECRET || env.JWTSECRET || '',
    algorithm: env.ENCRYPT_ALGORITHM || 'aes-256-ecb',
    deprecatedFlags: {
      MX_ENCRYPT_ENABLE: env.MX_ENCRYPT_ENABLE,
      ENCRYPT_ENABLE: env.ENCRYPT_ENABLE,
      MX_SECRET_STORAGE_V2: env.MX_SECRET_STORAGE_V2,
    },
  }
}

export function inspectSecretStorageConfig(config: SecretStorageConfig) {
  const issues: { code: string; path?: string }[] = []
  if (!config.key) issues.push({ code: 'FIELD_KEY_MISSING' })
  else if (typeof config.key !== 'string' || !/^[\da-f]{64}$/i.test(config.key))
    issues.push({ code: 'FIELD_KEY_INVALID' })
  if (typeof config.jwtSecret !== 'string' || config.jwtSecret.length < 32)
    issues.push({ code: 'JWT_TOO_SHORT' })
  for (const [path, value] of Object.entries(config.deprecatedFlags ?? {})) {
    if (
      value !== undefined &&
      value !== true &&
      value !== 'true' &&
      value !== '1'
    ) {
      issues.push({ code: 'DEPRECATED_ENCRYPTION_FLAG', path })
    }
  }
  return issues
}

export function assertSecretStorageConfig(config: SecretStorageConfig) {
  const issues = inspectSecretStorageConfig(config)
  if (issues.length) {
    throw new Error(
      issues
        .map(({ code, path }) => {
          if (code === 'JWT_TOO_SHORT')
            return 'JWT_SECRET must be at least 32 characters; preserve existing secrets or use upgrade:rotate-jwt during maintenance'
          if (code === 'DEPRECATED_ENCRYPTION_FLAG')
            return `${path} is no longer supported: encryption and V2 writes are required. Remove this deprecated flag`
          return 'Encryption requires an explicit 64-character hexadecimal MX_ENCRYPT_KEY or ENCRYPT_KEY; preserve your existing key'
        })
        .join('\n'),
    )
  }
  const flags = Object.entries(config.deprecatedFlags ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([name]) => name)
  if (flags.length)
    console.warn(
      `${flags.join(', ')}: deprecated encryption flags are ignored; remove them. Encryption and V2 writes are always required.`,
    )
}
