import crypto from 'node:crypto'
import path from 'node:path'

import { customAlphabet } from 'nanoid'

import { alphabet } from '~/constants/other.constant'

/**
 * Filename template placeholder substitution utility.
 * Supported placeholders:
 * - {Y} Year (4 digits)
 * - {y} Year (2 digits)
 * - {m} Month (2 digits)
 * - {d} Day (2 digits)
 * - {h} Hour (2 digits)
 * - {i} Minute (2 digits)
 * - {s} Second (2 digits)
 * - {ms} Millisecond (3 digits)
 * - {timestamp} Timestamp (milliseconds)
 * - {md5} Random MD5 string (32 chars)
 * - {md5-16} Random MD5 string (16 chars)
 * - {uuid} UUID string
 * - {str-<n>} Random string; number specifies length
 * - {filename} Original filename (with extension)
 * - {name} Original filename (without extension)
 * - {ext} Extension (with dot)
 * - {type} File type
 * - {localFolder:<n>} Original folder of the file; number specifies depth
 * - {readerId} Reader ID (for comment uploads only)
 */
export interface FilenameTemplateContext {
  /**
   * Original filename (including extension)
   */
  originalFilename: string

  /**
   * File type (e.g. image, file, avatar, icon)
   */
  fileType?: string

  /**
   * Local folder path (used for the localFolder placeholder)
   */
  localFolderPath?: string

  /**
   * Reader ID (used for the {readerId} placeholder in comment uploads)
   */
  readerId?: string
}

/**
 * Generate a random MD5-like hex string.
 */
function generateRandomMd5(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Generate a UUID v4 string.
 */
function generateUuid(): string {
  return crypto.randomUUID()
}

/**
 * Format a number with leading zeros to the given length.
 */
function padZero(num: number, length: number): string {
  return num.toString().padStart(length, '0')
}

/**
 * Extract folder segments from a path.
 * @param folderPath The folder path.
 * @param level Number of trailing segments to extract.
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
 * Replace placeholders in the template string.
 * @param template Template string.
 * @param context Context information.
 * @returns The substituted string.
 */
export function replaceFilenameTemplate(
  template: string,
  context: FilenameTemplateContext,
): string {
  const now = new Date()
  const {
    originalFilename,
    fileType = '',
    localFolderPath,
    readerId = '',
  } = context

  // Extract filename and extension
  const ext = path.extname(originalFilename).toLowerCase()
  const nameWithoutExt = path.basename(originalFilename, ext)

  let result = template

  // Date/time placeholders
  result = result.replaceAll('{Y}', now.getFullYear().toString())
  result = result.replaceAll('{y}', padZero(now.getFullYear() % 100, 2))
  result = result.replaceAll('{m}', padZero(now.getMonth() + 1, 2))
  result = result.replaceAll('{d}', padZero(now.getDate(), 2))
  result = result.replaceAll('{h}', padZero(now.getHours(), 2))
  result = result.replaceAll('{i}', padZero(now.getMinutes(), 2))
  result = result.replaceAll('{s}', padZero(now.getSeconds(), 2))
  result = result.replaceAll('{ms}', padZero(now.getMilliseconds(), 3))
  result = result.replaceAll('{timestamp}', now.getTime().toString())

  // Random string placeholders
  result = result.replaceAll('{md5}', () => generateRandomMd5())
  result = result.replaceAll('{md5-16}', () => generateRandomMd5().slice(0, 16))
  result = result.replaceAll('{uuid}', () => generateUuid())

  // Random string with custom length: {str-<n>}
  // eslint-disable-next-line unicorn/better-regex
  result = result.replaceAll(/\{str-(\d+)\}/g, (_match, length) => {
    const len = Number.parseInt(length, 10)
    return customAlphabet(alphabet)(len)
  })

  // Filename placeholders
  result = result.replaceAll('{filename}', originalFilename)
  result = result.replaceAll('{name}', nameWithoutExt)
  result = result.replaceAll('{ext}', ext)

  // File type placeholder
  result = result.replaceAll('{type}', fileType)

  // Reader ID placeholder (for comment uploads only)
  result = result.replaceAll('{readerId}', readerId)

  // Local folder placeholder: {localFolder:<n>}
  // eslint-disable-next-line unicorn/better-regex
  result = result.replaceAll(/\{localFolder:(\d+)\}/g, (_match, level) => {
    const lvl = Number.parseInt(level, 10)
    return extractFolderLevel(localFolderPath, lvl)
  })

  // Prevent path traversal: strip any parent-directory references (..)
  const segments = result.split(/[/\\]+/)
  const safeSegments = segments.filter((segment) => segment !== '..')
  const safeResult = safeSegments.join('/')

  return safeResult
}

/**
 * Generate a filename (using a template or the default rule).
 * @param config Configuration object.
 * @param context Context information.
 * @returns The generated filename.
 */
export function generateFilename(
  config: {
    enableCustomNaming?: boolean
    filenameTemplate?: string
  },
  context: FilenameTemplateContext,
): string {
  // Fall back to the default rule when custom naming is disabled or no template is provided
  if (!config.enableCustomNaming || !config.filenameTemplate) {
    const ext = path.extname(context.originalFilename).toLowerCase()
    return customAlphabet(alphabet)(18) + ext
  }

  return replaceFilenameTemplate(config.filenameTemplate, context)
}

/**
 * Generate a file path (using a template or the default rule).
 * @param config Configuration object.
 * @param context Context information.
 * @returns The generated path.
 */
export function generateFilePath(
  config: {
    enableCustomNaming?: boolean
    pathTemplate?: string
  },
  context: FilenameTemplateContext,
): string {
  // Fall back to the default rule (file type) when custom naming is disabled or no path template is provided
  if (!config.enableCustomNaming || !config.pathTemplate) {
    return context.fileType || ''
  }

  return replaceFilenameTemplate(config.pathTemplate, context)
}
