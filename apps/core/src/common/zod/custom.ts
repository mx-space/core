import { canonicalizeLanguageTag, isKnownLanguageTag } from '@mx-space/ai'
import { z } from 'zod'

import { resolveRequestedLanguage } from '~/utils/lang.util'

export const zBooleanOrString = z.union([z.boolean(), z.string()])

export const zPinDate = z.preprocess((val) => {
  if (val === null || val === undefined) return val
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    const date = new Date(val)
    if (!Number.isNaN(date.getTime())) return date
  }
  if (val === true) return new Date()
  if (val === false) return null
  return val
}, z.date().nullable().optional())

export const zSlug = z
  .string()
  .min(1)
  .transform((val) => val.trim())

export const zEmail = (message = 'Please enter a valid email address') =>
  z.email({ error: message })

export const zMaxLengthString = (max: number, message?: string) =>
  z.string().max(max, message || `Must not exceed ${max} characters`)

export const zRefTypeTransform = z.preprocess((val) => {
  if (!val || typeof val !== 'string') return val
  const mapping: Record<string, string> = {
    post: 'Post',
    note: 'Note',
    page: 'Page',
    recently: 'Recently',
  }
  return mapping[val.toLowerCase()] || val
}, z.string().optional())

export const zPrefer = z.enum(['lexical']).optional()

export const zLanguageTag = z
  .string()
  .trim()
  .refine(isKnownLanguageTag, { error: 'invalid BCP 47 language tag' })
  .transform((tag) => canonicalizeLanguageTag(tag)!)

export const zArticleMeta = z
  .record(z.string(), z.any())
  .transform((meta, ctx) => {
    if (!('lang' in meta)) return meta
    const { lang, ...rest } = meta
    if (lang == null || lang === '') return rest
    if (typeof lang !== 'string' || !isKnownLanguageTag(lang)) {
      ctx.addIssue({
        code: 'custom',
        message: 'invalid BCP 47 language tag',
        path: ['lang'],
      })
      return z.NEVER
    }
    return { ...rest, lang: canonicalizeLanguageTag(lang)! }
  })

export const zLang = z
  .preprocess((val) => resolveRequestedLanguage(val), z.string().optional())
  .optional()
