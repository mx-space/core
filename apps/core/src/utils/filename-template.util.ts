import crypto from 'node:crypto'
import path from 'node:path'
import { alphabet } from '~/constants/other.constant'
import { customAlphabet } from 'nanoid'

/**
 * 文件名模板占位符替换工具
 * 支持的占位符:
 * - {Y} 年份 (4位)
 * - {y} 年份 (2位)
 * - {m} 月份 (2位)
 * - {d} 日期 (2位)
 * - {h} 小时 (2位)
 * - {i} 分钟 (2位)
 * - {s} 秒钟 (2位)
 * - {ms} 毫秒 (3位)
 * - {timestamp} 时间戳 (毫秒)
 * - {md5} 随机MD5字符串 (32位)
 * - {md5-16} 随机MD5字符串 (16位)
 * - {uuid} UUID字符串
 * - {str-数字} 随机字符串，数字表示长度
 * - {filename} 原文件名 (包含扩展名)
 * - {name} 原文件名 (不含扩展名)
 * - {ext} 扩展名 (包含点号)
 * - {type} 文件类型
 * - {localFolder:数字} 原文件所在文件夹 (数字表示层级)
 */
export interface FilenameTemplateContext {
  /**
   * 原始文件名 (包含扩展名)
   */
  originalFilename: string

  /**
   * 文件类型 (如: image, file, avatar, icon)
   */
  fileType?: string

  /**
   * 本地文件夹路径 (用于 localFolder 占位符)
   */
  localFolderPath?: string
}

/**
 * 生成一个随机的 MD5 字符串
 */
function generateRandomMd5(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 生成一个 UUID v4 字符串
 */
function generateUuid(): string {
  return crypto.randomUUID()
}

/**
 * 格式化数字，补零到指定位数
 */
function padZero(num: number, length: number): string {
  return num.toString().padStart(length, '0')
}

/**
 * 提取文件名中的文件夹层级
 * @param folderPath 文件夹路径
 * @param level 提取的层级数
 */
function extractFolderLevel(
  folderPath: string | undefined,
  level: number,
): string {
  if (!folderPath) return ''

  const parts = folderPath.split(/[/\\]/).filter(Boolean)
  if (level <= 0 || level > parts.length) return ''

  return parts.slice(-level).join('/')
}

/**
 * 替换模板中的占位符
 * @param template 模板字符串
 * @param context 上下文信息
 * @returns 替换后的字符串
 */
export function replaceFilenameTemplate(
  template: string,
  context: FilenameTemplateContext,
): string {
  const now = new Date()
  const { originalFilename, fileType = '', localFolderPath } = context

  // 提取文件名和扩展名
  const ext = path.extname(originalFilename).toLowerCase()
  const nameWithoutExt = path.basename(originalFilename, ext)

  let result = template

  // 时间相关占位符
  result = result.replaceAll('{Y}', now.getFullYear().toString())
  result = result.replaceAll('{y}', padZero(now.getFullYear() % 100, 2))
  result = result.replaceAll('{m}', padZero(now.getMonth() + 1, 2))
  result = result.replaceAll('{d}', padZero(now.getDate(), 2))
  result = result.replaceAll('{h}', padZero(now.getHours(), 2))
  result = result.replaceAll('{i}', padZero(now.getMinutes(), 2))
  result = result.replaceAll('{s}', padZero(now.getSeconds(), 2))
  result = result.replaceAll('{ms}', padZero(now.getMilliseconds(), 3))
  result = result.replaceAll('{timestamp}', now.getTime().toString())

  // 随机字符串占位符
  result = result.replaceAll('{md5}', () => generateRandomMd5())
  result = result.replaceAll('{md5-16}', () => generateRandomMd5().slice(0, 16))
  result = result.replaceAll('{uuid}', () => generateUuid())

  // 自定义长度的随机字符串 {str-数字}
  result = result.replaceAll(/\{str-(\d+)\}/g, (_match, length) => {
    const len = Number.parseInt(length, 10)
    return customAlphabet(alphabet)(len)
  })

  // 文件名相关占位符
  result = result.replaceAll('{filename}', originalFilename)
  result = result.replaceAll('{name}', nameWithoutExt)
  result = result.replaceAll('{ext}', ext)

  // 文件类型占位符
  result = result.replaceAll('{type}', fileType)

  // 本地文件夹占位符 {localFolder:数字}
  result = result.replaceAll(/\{localFolder:(\d+)\}/g, (_match, level) => {
    const lvl = Number.parseInt(level, 10)
    return extractFolderLevel(localFolderPath, lvl)
  })

  return result
}

/**
 * 生成文件名（应用模板或使用默认规则）
 * @param config 配置对象
 * @param context 上下文信息
 * @returns 生成的文件名
 */
export function generateFilename(
  config: {
    enableCustomNaming?: boolean
    filenameTemplate?: string
  },
  context: FilenameTemplateContext,
): string {
  // 如果未启用自定义命名或没有模板，使用默认规则
  if (!config.enableCustomNaming || !config.filenameTemplate) {
    const ext = path.extname(context.originalFilename).toLowerCase()
    return customAlphabet(alphabet)(18) + ext
  }

  return replaceFilenameTemplate(config.filenameTemplate, context)
}

/**
 * 生成文件路径（应用模板或使用默认规则）
 * @param config 配置对象
 * @param context 上下文信息
 * @returns 生成的路径
 */
export function generateFilePath(
  config: {
    enableCustomNaming?: boolean
    pathTemplate?: string
  },
  context: FilenameTemplateContext,
): string {
  // 如果未启用自定义命名或没有路径模板，使用默认规则（文件类型）
  if (!config.enableCustomNaming || !config.pathTemplate) {
    return context.fileType || ''
  }

  return replaceFilenameTemplate(config.pathTemplate, context)
}
