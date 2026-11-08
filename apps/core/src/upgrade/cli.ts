import { parseArgs } from 'node:util'

import { Pool } from 'pg'

import { secretStorageConfigFromEnv } from '../utils/secret-storage-config'
import { rotateJwtSecret } from './jwt-rotation'
import { readUpgradeState, type UpgradeConfig } from './readiness'
import { UpgradeError } from './upgrade.error'

export function upgradeConfigFromEnv(env: NodeJS.ProcessEnv): UpgradeConfig {
  return secretStorageConfigFromEnv(env)
}

export async function runUpgradeCli(
  args: string[],
  env = process.env,
  write = (output: string) => process.stdout.write(`${output}\n`),
): Promise<number> {
  const [command, ...flags] = args
  let values: ReturnType<typeof parseArgs>['values']
  try {
    values = parseArgs({
      args: flags,
      options: {
        json: { type: 'boolean' },
        ...(command === 'rotate-jwt'
          ? {
              'maintenance-confirmed': { type: 'boolean' as const },
              'old-jwt-file': { type: 'string' as const },
              'new-jwt-file': { type: 'string' as const },
            }
          : {}),
      },
    }).values
  } catch {
    write('Invalid upgrade arguments')
    return 1
  }
  if (!['check', 'rotate-jwt'].includes(command)) {
    write(
      'Usage: upgrade check [--json] | rotate-jwt --maintenance-confirmed --old-jwt-file <path> --new-jwt-file <path>',
    )
    return 1
  }
  const pool = new Pool({
    connectionString: env.PG_URL || env.PG_CONNECTION_STRING,
    host: env.PG_HOST || '127.0.0.1',
    port: Number(env.PG_PORT || 5432),
    user: env.PG_USER || 'mx',
    password: env.PG_PASSWORD || 'mx',
    database: env.PG_DATABASE || 'mx_core',
    ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  try {
    if (command === 'rotate-jwt') {
      if (
        typeof values['old-jwt-file'] !== 'string' ||
        typeof values['new-jwt-file'] !== 'string'
      )
        throw new UpgradeError('JWT_FILE_PATHS_REQUIRED')
      const result = await rotateJwtSecret(pool, {
        maintenanceConfirmed: values['maintenance-confirmed'] === true,
        oldJwtFile: values['old-jwt-file'],
        newJwtFile: values['new-jwt-file'],
      })
      write(JSON.stringify(result))
      return 0
    }
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
  } catch (error) {
    // Driver/decryption messages can contain connection strings or stored values.
    write(
      JSON.stringify({
        target: 18,
        status: 'error',
        issues: [
          error instanceof UpgradeError
            ? { code: error.code, path: error.path }
            : {
                code:
                  command === 'check'
                    ? 'UPGRADE_CHECK_FAILED'
                    : 'JWT_ROTATION_FAILED',
              },
        ],
      }),
    )
    return 1
  } finally {
    await pool.end()
  }
}
