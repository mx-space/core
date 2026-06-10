import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { installPackage } from '@antfu/install-pkg'

import { NODE_REQUIRE_PATH } from '~/constants/path.constant'
import { logger } from '~/global/consola.global'

export const md5 = (text: string) =>
  createHash('md5').update(text).digest('hex') as string

export function getAvatar(mail: string | null | undefined) {
  if (!mail) {
    return ''
  }
  return `https://cravatar.cn/avatar/${md5(mail)}?d=retro`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function hasChinese(str: string) {
  return !escape(str).includes('%u') ? false : true
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

/**
 * hash string
 */
export const hashString = function (str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
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

export const camelcaseKey = (key: string) =>
  key.replaceAll(/_(\w)/g, (_, c) => (c ? c.toUpperCase() : ''))

export const camelcaseKeys = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((element) => camelcaseKeys(element))
  }
  const n: any = {}
  Object.keys(obj).forEach((k) => {
    n[camelcaseKey(k)] = camelcaseKeys(obj[k])
  })
  return n
}

export const parseBooleanishValue = (value: string | boolean | undefined) => {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  if (typeof value === 'undefined') return undefined
  return false
}

const XML_ESCAPE_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}

export function escapeXml(unsafe: string) {
  return unsafe.replaceAll(/["&'<>]/g, (c) => XML_ESCAPE_MAP[c] ?? c)
}

export const requireDepsWithInstall = async (deps: string) => {
  const require = createRequire(NODE_REQUIRE_PATH)
  try {
    return require(require.resolve(deps))
  } catch {
    logger.info(`Installing ${deps}...`)
    await installPackage(deps, { silent: false, cwd: NODE_REQUIRE_PATH })
    return require(deps)
  }
}
