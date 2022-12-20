import { isPlainObject } from '.'

/**
 * A simple camelCase function that only handles strings, but not handling symbol, date, or other complex case.
 * If you need to handle more complex cases, please use camelcase-keys package.
 */
export const camelcaseKeys = <T = any>(obj: any): T => {
  if (Array.isArray(obj)) {
    return obj.map((x) => camelcaseKeys(x)) as any
  }

  if (isPlainObject(obj)) {
    return Object.keys(obj).reduce((result: any, key) => {
      result[camelcase(key)] = camelcaseKeys(obj[key])
      return result
    }, {}) as any
  }

  return obj
}

export function camelcase(str: string) {
  return str.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '')
  })
}
