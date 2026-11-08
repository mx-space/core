import { isArrayLike, isObject } from 'es-toolkit/compat'

import { EncryptUtil } from '~/utils/encrypt.util'

import { isEncryptedPath } from './configs.secret-paths'

export { getExtractedEncryptedPaths } from './configs.secret-paths'

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
          value[i] = EncryptUtil.decrypt(value[i], itemPath)
        }
      }
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(target as any)[key] = decryptObject(value, currentPath)
    } else if (typeof value === 'string' && isEncryptedPath(currentPath)) {
      ;(target as any)[key] = EncryptUtil.decrypt(value, currentPath)
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
          value[i] = EncryptUtil.encrypt(value[i], itemPath)
        }
      }
    } else if (isObject(value) && !isArrayLike(value)) {
      ;(target as any)[key] = encryptObject(value, currentPath)
    } else if (typeof value === 'string' && isEncryptedPath(currentPath)) {
      ;(target as any)[key] = EncryptUtil.encrypt(value, currentPath)
    }
  }
  return target
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
 * Remove blank (empty string or null) values from encrypted fields
 * This prevents blank values from overwriting existing encrypted data during merge
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
      (value === '' || value === null) &&
      isEncryptedPath(currentPath)
    ) {
      delete (result as any)[key]
    }
  }

  return result
}
