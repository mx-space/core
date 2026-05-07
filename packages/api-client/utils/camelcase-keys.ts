import { isPlainObject } from '.'

export interface CamelcaseKeysOptions {
  /**
   * Predicate to keep a key untouched. Composed (OR) with the built-in
   * legacy MongoDB ObjectId skip — pass this for application-level
   * identity-keyed maps (URL keys, snowflakes, slugs, …) that the generic
   * function has no business knowing about on its own.
   */
  shouldSkipKey?: (key: string) => boolean
}

/**
 * A simple camelCase function that only handles strings, but not handling symbol, date, or other complex case.
 * If you need to handle more complex cases, please use camelcase-keys package.
 *
 * Built-in: skip Mongo ObjectId-shaped keys (24 hex chars) — kept for
 * historical MongoDB-era responses where ObjectIds appear as map keys.
 *
 * Anything else that should not be camelcased (URL keys, custom IDs) must be
 * declared by the caller via {@link CamelcaseKeysOptions.shouldSkipKey}.
 */
export const camelcaseKeys = <T = any>(
  obj: any,
  options: CamelcaseKeysOptions = {},
): T => {
  if (Array.isArray(obj)) {
    return obj.map((x) => camelcaseKeys(x, options)) as any
  }

  if (isPlainObject(obj)) {
    return Object.keys(obj).reduce((result: any, key) => {
      const skip = isMongoId(key) || options.shouldSkipKey?.(key) === true
      const nextKey = skip ? key : camelcase(key)
      result[nextKey] = camelcaseKeys(obj[key], options)
      return result
    }, {}) as any
  }

  return obj
}

export function camelcase(str: string) {
  return str.replace(/^_+/, '').replaceAll(/([_-][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '')
  })
}
const isMongoId = (id: string) => id.length === 24 && /^[\da-f]{24}$/i.test(id)
