import { cloneDeep } from 'es-toolkit/compat'
import type { z } from 'zod'

import { generateDefaultConfig } from './configs.default'
import type { IConfig } from './configs.interface'
import { configSchemaMapping } from './configs.schema'
import { isEncryptedPath } from './configs.secret-paths'

function unwrap(schema: z.ZodType): any {
  let def = (schema as any)?._zod?.def
  while (def?.innerType || (def?.type === 'pipe' && def.in)) {
    schema = def.innerType ?? def.in
    def = (schema as any)._zod?.def
  }
  return def
}

/** Normalize declared keys only. Record/freeform payloads remain verbatim. */
export function normalizeConfigPatch(schema: z.ZodType, value: any): any {
  const def = unwrap(schema)
  if (def?.type === 'array' && Array.isArray(value))
    return value.map((item) => normalizeConfigPatch(def.element, item))
  if (
    def?.type !== 'object' ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return value
  const shape = typeof def.shape === 'function' ? def.shape() : def.shape
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const name = key.replaceAll(/_(\w)/g, (_, c) => c.toUpperCase())
      return [
        name,
        shape[name] ? normalizeConfigPatch(shape[name], item) : item,
      ]
    }),
  )
}

export function unknownConfigPaths(
  schema: z.ZodType,
  value: any,
  prefix: string,
): string[] {
  const def = unwrap(schema)
  if (def?.type === 'array' && Array.isArray(value))
    return value.flatMap((item, index) =>
      unknownConfigPaths(def.element, item, `${prefix}.${index}`),
    )
  if (
    def?.type !== 'object' ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return []
  const shape = typeof def.shape === 'function' ? def.shape() : def.shape
  return Object.entries(value).flatMap(([key, item]) => {
    const path = `${prefix}.${key}`
    return Object.hasOwn(shape, key)
      ? unknownConfigPaths(shape[key], item, path)
      : [path]
  })
}

/** No historical transforms: a missed migration must fail before cache publication. */
export function loadCurrentConfig(raw: Record<string, any>): IConfig {
  const requireMigration = (path: string): never => {
    throw new Error(
      `Configuration data migration is required (${path}); run node migrate.mjs before starting the app`,
    )
  }
  for (const name of ['imageGenerationOptions', 'ttsOptions'])
    if (name in raw) requireMigration(name)
  const config = generateDefaultConfig()
  for (const [key, schema] of Object.entries(configSchemaMapping)) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (!value || typeof value !== 'object' || Array.isArray(value))
      requireMigration(key)
    if (key === 'ai' && value.version !== 2) requireMigration('ai.version')
    const unknown = unknownConfigPaths(schema, value, key)
    if (unknown.length) requireMigration(unknown[0])
    ;(config as any)[key] = { ...config[key], ...cloneDeep(value) }
  }
  return config
}

/** Empty optional credentials are legitimate stored defaults, not corrupt data. */
export function isValidStoredConfig(
  key: keyof typeof configSchemaMapping,
  value: unknown,
): boolean {
  const result = configSchemaMapping[key].safeParse(value)
  if (result.success) return true
  return result.error.issues.every((issue) => {
    const field = issue.path.reduce<any>((node, part) => node?.[part], value)
    return (
      isEncryptedPath([key, ...issue.path].join('.')) &&
      ((issue.code === 'too_small' && field === '') ||
        (issue.code === 'invalid_type' && field === null))
    )
  })
}
