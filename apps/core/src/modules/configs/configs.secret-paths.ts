import type { z } from 'zod'

import { configSchemaMapping } from './configs.schema'
import { getMeta } from './configs.zod-schema.util'

// Cached encrypted paths extracted from schemas
let cachedEncryptedPaths: Set<string> | null = null

/**
 * Extract encrypted field paths from all config schemas
 */
function getEncryptedPaths(): Set<string> {
  if (cachedEncryptedPaths) {
    return cachedEncryptedPaths
  }

  cachedEncryptedPaths = new Set<string>([
    'thirdPartyServiceIntegration.githubToken',
    'membership.dodoApiKey',
    'membership.dodoWebhookKey',
  ])

  for (const [sectionKey, schema] of Object.entries(configSchemaMapping)) {
    const paths = collectEncryptedPathsFromSchema(schema, sectionKey)
    paths.forEach((p) => cachedEncryptedPaths!.add(p))
  }

  return cachedEncryptedPaths
}

/**
 * Get the type name from a Zod schema (Zod 4.x compatible)
 */
function getZodTypeName(schema: z.ZodType): string {
  // Zod 4.x uses _zod.def.type
  const zodDef = (schema as any)._zod?.def
  if (zodDef?.type) {
    return zodDef.type
  }
  // Fallback for direct .type property
  if ((schema as any).type) {
    return (schema as any).type
  }
  return ''
}

/**
 * Get the inner type from wrapper types (optional, nullable, default, etc.)
 */
function getInnerType(schema: z.ZodType): z.ZodType | null {
  const zodDef = (schema as any)._zod?.def
  return zodDef?.innerType || null
}

/**
 * Get the shape from an object schema
 */
function getObjectShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  // Try direct .shape property first (Zod 4.x)
  if ((schema as any).shape && typeof (schema as any).shape === 'object') {
    return (schema as any).shape
  }
  // Try _zod.def.shape (might be a getter)
  const zodDef = (schema as any)._zod?.def
  if (typeof zodDef?.shape === 'function') {
    return zodDef.shape()
  }
  if (zodDef?.shape && typeof zodDef.shape === 'object') {
    return zodDef.shape
  }
  return null
}

/**
 * Get the element type from an array schema
 */
function getArrayElementType(schema: z.ZodType): z.ZodType | null {
  const zodDef = (schema as any)._zod?.def
  return zodDef?.element || zodDef?.type || null
}

/**
 * Recursively collect encrypted field paths from a Zod schema
 * @param schema - The Zod schema to analyze
 * @param prefix - Current path prefix
 * @param parentEncrypt - Whether a parent is marked as encrypt (for subtree encryption)
 */
function collectEncryptedPathsFromSchema(
  schema: z.ZodType,
  prefix: string,
  parentEncrypt = false,
): Set<string> {
  const paths = new Set<string>()

  // Check if this schema has encrypt metadata
  const meta = getMeta(schema)
  const isEncrypt = meta?.encrypt || parentEncrypt

  const typeName = getZodTypeName(schema)

  // Unwrap wrapper types
  if (
    typeName === 'optional' ||
    typeName === 'nullable' ||
    typeName === 'default'
  ) {
    const innerType = getInnerType(schema)
    if (innerType) {
      const innerPaths = collectEncryptedPathsFromSchema(
        innerType,
        prefix,
        isEncrypt,
      )
      innerPaths.forEach((p) => paths.add(p))
    }
    return paths
  }

  // For leaf types (string, number, etc.), if marked as encrypt, add the path
  if (
    isEncrypt &&
    typeName !== 'object' &&
    typeName !== 'array' &&
    typeName !== 'record'
  ) {
    paths.add(prefix)
    return paths
  }

  // Handle object types
  if (typeName === 'object') {
    const shape = getObjectShape(schema)
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const childPaths = collectEncryptedPathsFromSchema(
          value,
          `${prefix}.${key}`,
          isEncrypt,
        )
        childPaths.forEach((p) => paths.add(p))
      }
    }
  }

  // Handle array types
  if (typeName === 'array') {
    const elementType = getArrayElementType(schema)
    if (elementType) {
      const elementPaths = collectEncryptedPathsFromSchema(
        elementType,
        `${prefix}.*`,
        isEncrypt,
      )
      elementPaths.forEach((p) => paths.add(p))
    }
  }

  // Handle record types (for oauth.secrets)
  if (typeName === 'record') {
    const zodDef = (schema as any)._zod?.def
    const valueType = zodDef?.valueType
    if (valueType) {
      const valuePaths = collectEncryptedPathsFromSchema(
        valueType,
        `${prefix}.*`,
        isEncrypt,
      )
      valuePaths.forEach((p) => paths.add(p))
    }
  }

  return paths
}

// Pre-compiled regex patterns cache
let compiledPatterns: Array<string | RegExp> | null = null

function getCompiledPatterns(): Array<string | RegExp> {
  if (compiledPatterns) {
    return compiledPatterns
  }

  const encryptedPaths = getEncryptedPaths()
  compiledPatterns = Array.from(encryptedPaths).map((pattern) => {
    if (pattern.includes('*')) {
      const regexStr = `^${pattern.replaceAll('.', String.raw`\.`).replaceAll('*', '[^.]+')}$`
      return new RegExp(regexStr)
    }
    return pattern
  })

  return compiledPatterns
}

/**
 * Check if a path matches any encrypted path pattern
 */
export function isEncryptedPath(path: string): boolean {
  for (const pattern of getCompiledPatterns()) {
    if (typeof pattern === 'string') {
      if (pattern === path) return true
    } else if (pattern.test(path)) {
      return true
    }
  }
  return false
}

export const getExtractedEncryptedPaths = (): string[] =>
  Array.from(getEncryptedPaths())

export function visitConfigSecrets<T>(
  value: T,
  prefix: string,
  visit: (secret: string, path: string) => string,
): T {
  if (typeof value === 'string')
    return (isEncryptedPath(prefix) ? visit(value, prefix) : value) as T
  if (Array.isArray(value))
    return value.map((item, index) =>
      visitConfigSecrets(item, `${prefix}.${index}`, visit),
    ) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        visitConfigSecrets(item, prefix ? `${prefix}.${key}` : key, visit),
      ]),
    ) as T
  return value
}
