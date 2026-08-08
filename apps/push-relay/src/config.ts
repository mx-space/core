import { readFileSync } from 'node:fs'

import { z } from 'zod'

import type { ApnsEnvironment } from './types.js'

const ApnsKeySchema = z
  .object({
    keyId: z.string().min(1),
    privateKeyPath: z.string().min(1),
  })
  .strict()

const ApnsAppSchema = z
  .object({
    id: z.string().min(1).max(64),
    bundleId: z.string().min(3),
    teamId: z.string().min(1),
    keyId: z.string().min(1).optional(),
    privateKeyPath: z.string().min(1).optional(),
    keys: z
      .object({
        development: ApnsKeySchema.optional(),
        production: ApnsKeySchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((app, context) => {
    const hasLegacyKey = app.keyId !== undefined
    const hasLegacyPath = app.privateKeyPath !== undefined
    if (hasLegacyKey !== hasLegacyPath) {
      context.addIssue({
        code: 'custom',
        message: 'keyId and privateKeyPath must be configured together',
      })
    }
    if (app.keys && (hasLegacyKey || hasLegacyPath)) {
      context.addIssue({
        code: 'custom',
        message: 'Use either keys or the legacy key fields, not both',
      })
    }
    if (
      !app.keys?.development &&
      !app.keys?.production &&
      !(hasLegacyKey && hasLegacyPath)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'At least one APNs environment key is required',
      })
    }
  })

export type ApnsKeyConfig = z.infer<typeof ApnsKeySchema> & {
  privateKey: string
}

export type ApnsAppConfig = Pick<
  z.infer<typeof ApnsAppSchema>,
  'id' | 'bundleId' | 'teamId'
> & {
  keys: Readonly<Partial<Record<ApnsEnvironment, ApnsKeyConfig>>>
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
    const loadKey = (key: z.infer<typeof ApnsKeySchema>): ApnsKeyConfig => ({
      ...key,
      privateKey: readFileSync(key.privateKeyPath, 'utf8'),
    })
    const keys: Partial<Record<ApnsEnvironment, ApnsKeyConfig>> = {}
    if (app.keys) {
      if (app.keys.development)
        keys.development = loadKey(app.keys.development)
      if (app.keys.production) keys.production = loadKey(app.keys.production)
    } else {
      const legacyKey = loadKey({
        keyId: app.keyId!,
        privateKeyPath: app.privateKeyPath!,
      })
      keys.development = legacyKey
      keys.production = legacyKey
    }
    appMap.set(app.id, {
      id: app.id,
      bundleId: app.bundleId,
      teamId: app.teamId,
      keys,
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
