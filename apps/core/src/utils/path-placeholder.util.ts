import { createHash, randomBytes } from 'node:crypto'
import { extname } from 'node:path'
import { v4 as uuidv4 } from 'uuid'

/**
 * {Y} - 年份 4位
 * {y} - 年份 2位
 * {m} - 月份 2位
 * {d} - 日期 2位
 * {h} - 小时 2位
 * {i} - 分钟 2位
 * {s} - 秒钟 2位
 * {ms} - 毫秒 3位
 * {timestamp} - 时间戳（毫秒）
 * {md5} - 随机MD5字符串（32位）
 * {md5-16} - 随机MD5字符串（16位）
 * {uuid} - UUID字符串
 * {str-N} - 随机字符串，N为数字，表示字符串的长度，例如 {str-8}
 * {filename} - 原文件名（不含扩展名）
 * {ext} - 文件扩展名（不含点）
 */

interface PlaceholderOptions {
  filename?: string
  date?: Date
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = randomBytes(length)
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

function generateMD5(length?: number): string {
  const hash = createHash('md5').update(randomBytes(16)).digest('hex')
  return length ? hash.slice(0, Math.max(0, length)) : hash
}

function pad(num: number, size: number): string {
  return String(num).padStart(size, '0')
}

/**
 * 解析路径占位符
 * @param template 包含占位符的路径模板
 * @param options 选项
 * @returns 解析后的路径
 */
export function parsePlaceholder(
  template: string,
  options: PlaceholderOptions = {},
): string {
  const { filename, date = new Date() } = options

  let baseFilename = ''
  let ext = ''
  if (filename) {
    ext = extname(filename).slice(1)
    baseFilename = filename.slice(0, filename.length - ext.length - 1)
  }

  const year4 = date.getFullYear()
  const year2 = String(year4).slice(-2)
  const month = pad(date.getMonth() + 1, 2)
  const day = pad(date.getDate(), 2)
  const hour = pad(date.getHours(), 2)
  const minute = pad(date.getMinutes(), 2)
  const second = pad(date.getSeconds(), 2)
  const millisecond = pad(date.getMilliseconds(), 3)
  const timestamp = date.getTime()

  let result = template

  result = result
    .replaceAll('{Y}', String(year4))
    .replaceAll('{y}', year2)
    .replaceAll('{m}', month)
    .replaceAll('{d}', day)
    .replaceAll('{h}', hour)
    .replaceAll('{i}', minute)
    .replaceAll('{s}', second)
    .replaceAll('{ms}', millisecond)
    .replaceAll('{timestamp}', String(timestamp))
    .replaceAll('{filename}', baseFilename)
    .replaceAll('{ext}', ext)
    .replaceAll('{uuid}', () => uuidv4())
    .replaceAll('{md5-16}', () => generateMD5(16))
    .replaceAll('{md5}', () => generateMD5())
    .replaceAll(/\{str-(\d+)\}/g, (_, length) => {
      return generateRandomString(Number.parseInt(length))
    })

  return result
}

/**
 * 验证路径模板是否有效
 * @param template 路径模板
 * @returns 是否有效
 */
export function validatePlaceholderTemplate(template: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // fuck eslint
  const illegalCharsPattern = /[<>"|?*]/
  const hasControlChars = [...template].some((char) => {
    const code = char.charCodeAt(0)
    return code >= 0 && code <= 31
  })

  if (illegalCharsPattern.test(template) || hasControlChars) {
    errors.push('路径模板包含非法字符')
  }

  const openBraces = (template.match(/\{/g) || []).length
  const closeBraces = (template.match(/\}/g) || []).length
  if (openBraces !== closeBraces) {
    errors.push('占位符括号未正确闭合')
  }

  const knownPlaceholders = [
    'Y',
    'y',
    'm',
    'd',
    'h',
    'i',
    's',
    'ms',
    'timestamp',
    'md5',
    'md5-16',
    'uuid',
    'filename',
    'ext',
  ]
  const placeholderPattern = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  placeholderPattern.lastIndex = 0

  while ((match = placeholderPattern.exec(template)) !== null) {
    const placeholder = match[1]
    if (
      !knownPlaceholders.includes(placeholder) &&
      !/^str-\d+$/.test(placeholder)
    ) {
      errors.push(`未知的占位符: {${placeholder}}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
