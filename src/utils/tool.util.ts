import { isObject } from 'lodash'

export const isDev = process.env.NODE_ENV == 'development'

export const isTest = !!process.env.TEST

export const md5 = (text: string) =>
  require('crypto').createHash('md5').update(text).digest('hex')

export function getAvatar(mail: string) {
  if (!mail) {
    return ''
  }
  return `https://sdn.geekzu.org/avatar/${md5(mail)}?d=retro`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function hasChinese(str: string) {
  return escape(str).indexOf('%u') < 0 ? false : true
}

export function deleteKeys<T extends KV>(
  target: T,
  keys: (keyof T)[],
): Partial<T>
export function deleteKeys<T extends KV>(
  target: T,
  keys: readonly (keyof T)[],
): Partial<T>
export function deleteKeys<T extends KV>(
  target: T,
  ...keys: string[]
): Partial<T>
export function deleteKeys<T extends KV>(
  target: T,
  ...keys: any[]
): Partial<T> {
  if (!isObject(target)) {
    throw new TypeError('target must be Object, got ' + target)
  }

  if (Array.isArray(keys[0])) {
    for (const key of keys[0]) {
      Reflect.deleteProperty(target, key)
    }
  } else {
    for (const key of keys) {
      Reflect.deleteProperty(target, key)
    }
  }

  return target
}
