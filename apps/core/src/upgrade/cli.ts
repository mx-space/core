import { Pool } from 'pg'

import { readUpgradeState, type UpgradeConfig } from './readiness'

export function upgradeConfigFromEnv(env: NodeJS.ProcessEnv): UpgradeConfig {
  const key = env.MX_ENCRYPT_KEY || env.ENCRYPT_KEY || ''
  const enabled = env.MX_ENCRYPT_ENABLE ?? env.ENCRYPT_ENABLE
  return {
    key,
    enable: enabled === undefined ? !!key : /^(?:true|1)$/i.test(enabled),
    v2: /^(?:true|1)$/i.test(env.MX_SECRET_STORAGE_V2 ?? ''),
    jwtSecret: env.JWT_SECRET || env.JWTSECRET || '',
    algorithm: env.ENCRYPT_ALGORITHM || 'aes-256-ecb',
  }
}

export async function runUpgradeCli(
  args: string[],
  env = process.env,
  write = (output: string) => process.stdout.write(`${output}\n`),
): Promise<number> {
  const [command, ...flags] = args
  if (command !== 'check' || flags.some((flag) => flag !== '--json')) {
    write('Usage: upgrade check [--json]')
    return 1
  }
  const pool = new Pool({
    connectionString: env.PG_URL || env.PG_CONNECTION_STRING,
    host: env.PG_HOST || '127.0.0.1',
    port: Number(env.PG_PORT || 5432),
    user: env.PG_USER || 'mx',
    password: env.PG_PASSWORD || 'mx',
    database: env.PG_DATABASE || 'mx_core',
    ssl: /^(?:true|1)$/i.test(env.PG_SSL ?? '')
      ? { rejectUnauthorized: false }
      : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const report = await readUpgradeState(client, upgradeConfigFromEnv(env))
      await client.query('COMMIT')
      write(
        flags.includes('--json')
          ? JSON.stringify(report)
          : `${report.status}: ${report.installation} installation\n${report.issues.map((issue) => `${issue.code}${issue.path ? ` (${issue.path})` : ''}`).join('\n')}`,
      )
      return report.status === 'ready' ? 0 : 2
    } finally {
      client.release()
    }
  } catch {
    // Driver/decryption messages can contain connection strings or stored values.
    write(
      JSON.stringify({
        target: 18,
        status: 'error',
        issues: [{ code: 'UPGRADE_CHECK_FAILED' }],
      }),
    )
    return 1
  } finally {
    await pool.end()
  }
}
