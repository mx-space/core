import { cloneDeep, isObject } from 'lodash'
import { join } from 'path'

export const md5 = (text: string) =>
  require('crypto').createHash('md5').update(text).digest('hex') as string

export function getAvatar(mail: string | undefined) {
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
    throw new TypeError(`target must be Object, got ${target}`)
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

export const safeJSONParse = (p: any) => {
  try {
    return JSON.parse(p)
  } catch {
    return null
  }
}

/**
 * remove `..`, `~`
 * @param path
 */
export const safePathJoin = (...path: string[]) => {
  const newPathArr = path.map((p) =>
    p
      .split('/')
      .map((o) => o.replace(/^(\.{2,}|~)$/, '.'))
      .join('/'),
  )

  return join(...newPathArr)
}

export const deepCloneWithFunction = <T extends object>(object: T): T => {
  const clonedModule = cloneDeep(object)

  if (typeof object === 'function') {
    // @ts-expect-error
    const newFunc = (object as Function).bind()

    Object.setPrototypeOf(newFunc, clonedModule)
    return newFunc
  }

  return clonedModule
}

/**
 * hash string
 */
export const hashString = function (str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export async function* asyncPool<T = any>(
  concurrency: number,
  iterable: T[],
  iteratorFn: (item: T, arr: T[]) => any,
) {
  const executing = new Set<Promise<any>>()
  async function consume() {
    const [promise, value] = await Promise.race(executing)
    executing.delete(promise)
    return value
  }
  for (const item of iterable) {
    // Wrap iteratorFn() in an async fn to ensure we get a promise.
    // Then expose such promise, so it's possible to later reference and
    // remove it from the executing pool.
    const promise = (async () => await iteratorFn(item, iterable))().then(
      (value) => [promise, value],
    )
    executing.add(promise)
    if (executing.size >= concurrency) {
      yield await consume()
    }
  }
  while (executing.size) {
    yield await consume()
  }
}
