import { metaFor } from '~/core/meta-for'
import type { ResponseAdapter, ResponseAdapterContext } from '~/interfaces/client'
import type { EntryTranslation, ResponseMeta } from '~/models/base'
import { attachRawFromOneToAnthor, destructureData, isPlainObject } from '~/utils'

export type LegacyResponseAdapterMatcher =
  | string
  | RegExp
  | ((context: ResponseAdapterContext) => boolean)

export interface LegacyResponseAdapterOptions {
  /**
   * Apply legacy conversion only to matched request paths.
   * String matchers compare against both `/path` and `METHOD /path`.
   */
  only?: LegacyResponseAdapterMatcher[]
  /**
   * Skip legacy conversion for matched request paths.
   * Useful when a downstream app migrates one endpoint at a time.
   */
  except?: LegacyResponseAdapterMatcher[]
}

const toMatcherList = (value: LegacyResponseAdapterMatcher[] | undefined) =>
  value?.length ? value : undefined

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function matches(
  context: ResponseAdapterContext,
  matcher: LegacyResponseAdapterMatcher,
) {
  if (typeof matcher === 'function') return matcher(context)

  const path = normalizePath(context.path)
  const methodPath = `${context.method.toUpperCase()} ${path}`
  if (typeof matcher === 'string') {
    return matcher === path || matcher === methodPath
  }

  return matcher.test(path) || matcher.test(methodPath)
}

function shouldTransform(
  context: ResponseAdapterContext,
  options: LegacyResponseAdapterOptions,
) {
  const only = toMatcherList(options.only)
  if (only && !only.some((matcher) => matches(context, matcher))) return false

  const except = toMatcherList(options.except)
  if (except?.some((matcher) => matches(context, matcher))) return false

  return true
}

function buildLegacyTranslationFields(
  translation: EntryTranslation | undefined,
) {
  const article = translation?.article
  if (!article) return {}

  return {
    isTranslated: article.isTranslated,
    translationMeta: article,
  }
}

function attachMetaToItem<T>(
  item: T,
  meta: ResponseMeta | undefined,
): T {
  if (!isPlainObject(item) || typeof (item as any).id !== 'string') return item

  const { interaction, translation } = metaFor(item as { id: string }, meta)
  const legacyFields = {
    ...buildLegacyTranslationFields(translation),
    ...interaction,
  }
  const hasLegacyFields = Object.keys(legacyFields).length > 0
  const responseMetaFields = {
    ...(meta?.enrichments ? { enrichments: meta.enrichments } : {}),
    ...(meta?.related ? { related: meta.related } : {}),
    ...(meta?.insights?.hasInLocale !== undefined
      ? { hasInsightsInLocale: meta.insights.hasInLocale }
      : {}),
  }
  const hasResponseMetaFields = Object.keys(responseMetaFields).length > 0

  if (!hasLegacyFields && !hasResponseMetaFields) return item

  const nextItem = {
    ...(item as Record<string, unknown>),
    ...legacyFields,
    ...responseMetaFields,
  }
  attachRawFromOneToAnthor(item, nextItem)
  return nextItem as T
}

function transformLegacyData<T>(data: T, meta: ResponseMeta | undefined): T {
  const normalizedData = destructureData(data)

  if (Array.isArray(normalizedData)) {
    return normalizedData.map((item) => attachMetaToItem(item, meta)) as T
  }

  if (
    isPlainObject(normalizedData) &&
    Array.isArray((normalizedData as any).data)
  ) {
    return {
      ...(normalizedData as Record<string, unknown>),
      data: (normalizedData as any).data.map((item: unknown) =>
        attachMetaToItem(item, meta),
      ),
    } as T
  }

  return attachMetaToItem(normalizedData, meta)
}

export function legacyResponseAdapter(
  options: LegacyResponseAdapterOptions = {},
): ResponseAdapter {
  return {
    transformData(data, context) {
      if (!shouldTransform(context, options)) return data
      return transformLegacyData(data, context.meta as ResponseMeta | undefined)
    },
  }
}
