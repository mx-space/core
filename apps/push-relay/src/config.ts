import { readFileSync } from 'node:fs'

import { z } from 'zod'

const ApnsAppSchema = z
  .object({
    id: z.string().min(1).max(64),
    bundleId: z.string().min(3),
    teamId: z.string().min(1),
    keyId: z.string().min(1),
    privateKeyPath: z.string().min(1),
  })
  .strict()

export type ApnsAppConfig = z.infer<typeof ApnsAppSchema> & {
  privateKey: string
}

export type PushRelayConfig = {
  port: number
  publicUrl: string
  databaseUrl: string
  dataKey: string
  apps: ReadonlyMap<string, ApnsAppConfig>
}

const required = (name: string, env: NodeJS.ProcessEnv) => {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
): PushRelayConfig => {
  const apps = z
    .array(ApnsAppSchema)
    .min(1)
    .parse(JSON.parse(required('PUSH_RELAY_APPS_JSON', env)))
  const appMap = new Map<string, ApnsAppConfig>()
  for (const app of apps) {
    if (appMap.has(app.id))
      throw new Error(`Duplicate Push Relay app id: ${app.id}`)
    appMap.set(app.id, {
      ...app,
      privateKey: readFileSync(app.privateKeyPath, 'utf8'),
    })
  }

  const publicUrl = new URL(required('PUSH_RELAY_PUBLIC_URL', env))
  const isLocal =
    publicUrl.hostname === 'localhost' ||
    publicUrl.hostname === '127.0.0.1' ||
    publicUrl.hostname === '::1' ||
    publicUrl.hostname.endsWith('.local')
  if (publicUrl.protocol !== 'https:' && !isLocal) {
    throw new Error('PUSH_RELAY_PUBLIC_URL must use HTTPS outside localhost')
  }

  const port = Number(env.PUSH_RELAY_PORT ?? 8787)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PUSH_RELAY_PORT must be a valid TCP port')
  }

  return {
    port,
    publicUrl: publicUrl.toString().replace(/\/$/, ''),
    databaseUrl: required('PUSH_RELAY_DATABASE_URL', env),
    dataKey: required('PUSH_RELAY_DATA_KEY', env),
    apps: appMap,
  }
}
