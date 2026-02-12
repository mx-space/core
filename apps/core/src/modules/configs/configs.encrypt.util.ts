import { EncryptUtil } from '~/utils/encrypt.util'
import { isArrayLike, isObject } from 'es-toolkit/compat'
import { LRUCache } from 'lru-cache'
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

  cachedEncryptedPaths = new Set<string>()

  for (const [sectionKey, schema] of Object.entries(configSchemaMapping)) {
    const paths = collectEncryptedPathsFromSchema(schema, sectionKey)
    paths.forEach((p) => cachedEncryptedPaths!.add(p))
  }

  return cachedEncryptedPaths
}

/**
 * Get the type name from a Zod schema (Zod 4.x compatible)
 */
function getZodTypeName(schema: z.ZodTypeAny): string {
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
function getInnerType(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const zodDef = (schema as any)._zod?.def
  return zodDef?.innerType || null
}

/**
 * Get the shape from an object schema
 */
function getObjectShape(
  schema: z.ZodTypeAny,
): Record<string, z.ZodTypeAny> | null {
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
function getArrayElementType(schema: z.ZodTypeAny): z.ZodTypeAny | null {
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
  schema: z.ZodTypeAny,
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
function isEncryptedPath(path: string): boolean {
  for (const pattern of getCompiledPatterns()) {
    if (typeof pattern === 'string') {
      if (pattern === path) return true
    } else if (pattern.test(path)) {
      return true
    }
  }
  return false
}

const decryptLRU = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 5,
})

/**
 * Decrypt a single value
 */
function decryptValue(value: string): string {
  if (decryptLRU.has(value)) {
    return decryptLRU.get(value)!
  }
  const decryptedValue = EncryptUtil.decrypt(value)
  decryptLRU.set(value, decryptedValue)
  return decryptedValue
}

/**
 * Recursively decrypt all encrypted fields in an object
 */
export const decryptObject = <T extends object>(target: T, prefix = ''): T => {
  const keys = Object.keys(target)
  for (const key of keys) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const value = (target as any)[key]

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = `${currentPath}.${i}`
        if (isObject(value[i]) && !isArrayLike(value[i])) {
          value[i] = decryptObject(value[i], itemPath)
        } else if (typeof value[i] === 'string' && isEncryptedPath(itemPath)) {
          value[i] = decryptValue(value[i])
        }
      }
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(target as any)[key] = decryptObject(value, currentPath)
    } else if (typeof value === 'string' && isEncryptedPath(currentPath)) {
      ;(target as any)[key] = decryptValue(value)
    }
  }
  return target
}

/**
 * Recursively encrypt all encrypted fields in an object
 */
export const encryptObject = <T extends object>(target: T, prefix = ''): T => {
  const keys = Object.keys(target)
  for (const key of keys) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const value = (target as any)[key]

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = `${currentPath}.${i}`
        if (isObject(value[i]) && !isArrayLike(value[i])) {
          value[i] = encryptObject(value[i], itemPath)
        } else if (typeof value[i] === 'string' && isEncryptedPath(itemPath)) {
          value[i] = EncryptUtil.encrypt(value[i])
        }
      }
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(target as any)[key] = encryptObject(value, currentPath)
    } else if (typeof value === 'string' && isEncryptedPath(currentPath)) {
      ;(target as any)[key] = EncryptUtil.encrypt(value)
    }
  }
  return target
}

// For debugging: export function to view extracted paths
export const getExtractedEncryptedPaths = (): string[] => {
  return Array.from(getEncryptedPaths())
}

/**
 * Remove encrypted fields from an object before sending to frontend
 * Sets encrypted field values to empty string
 */
export const sanitizeConfigForResponse = <T extends object>(
  target: T,
  prefix = '',
): T => {
  const result = { ...target }
  const keys = Object.keys(result)

  for (const key of keys) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const value = (result as any)[key]

    if (Array.isArray(value)) {
      ;(result as any)[key] = value.map((item, i) => {
        const itemPath = `${currentPath}.${i}`
        if (isObject(item) && !isArrayLike(item)) {
          return sanitizeConfigForResponse(item, itemPath)
        } else if (typeof item === 'string' && isEncryptedPath(itemPath)) {
          return ''
        }
        return item
      })
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(result as any)[key] = sanitizeConfigForResponse(value, currentPath)
    } else if (typeof value === 'string' && isEncryptedPath(currentPath)) {
      ;(result as any)[key] = ''
    }
  }

  return result
}

/**
 * Remove empty string values from encrypted fields
 * This prevents empty values from overwriting existing encrypted data during merge
 */
export const removeEmptyEncryptedFields = <T extends object>(
  target: T,
  prefix = '',
): T => {
  const result = { ...target }
  const keys = Object.keys(result)

  for (const key of keys) {
    const currentPath = prefix ? `${prefix}.${key}` : key
    const value = (result as any)[key]

    if (Array.isArray(value)) {
      ;(result as any)[key] = value
        .map((item, i) => {
          const itemPath = `${currentPath}.${i}`
          if (isObject(item) && !isArrayLike(item)) {
            return removeEmptyEncryptedFields(item, itemPath)
          } else if (
            typeof item === 'string' &&
            item === '' &&
            isEncryptedPath(itemPath)
          ) {
            return undefined
          }
          return item
        })
        .filter((item) => item !== undefined)
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(result as any)[key] = removeEmptyEncryptedFields(value, currentPath)
    } else if (
      typeof value === 'string' &&
      value === '' &&
      isEncryptedPath(currentPath)
    ) {
      delete (result as any)[key]
    }
  }

  return result
}
