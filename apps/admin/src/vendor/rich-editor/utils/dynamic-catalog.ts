import type { ChatMessage } from '@haklex/rich-agent-core'
import { useEffect, useState } from 'react'

import type {
  DynamicCatalog,
  DynamicCatalogEntry,
  DynamicCatalogEntryPatch,
} from '~/api/dynamic-components'
import {
  getDynamicCatalogUrl,
  getDynamicComponents,
  registerDynamicComponentEntry,
  updateDynamicComponentEntry,
} from '~/api/dynamic-components'
import { ApiRequestError } from '~/api/http'
import { API_URL } from '~/constants/env'

export type { DynamicCatalog, DynamicCatalogEntry }
export { getDynamicCatalogUrl }

const catalogUrls = new Set<string>()

let cachedCatalogPromise: Promise<DynamicCatalog | null> | null = null

function rememberCatalog(catalog: DynamicCatalog | null) {
  for (const c of catalog?.components ?? []) {
    catalogUrls.add(c.url)
    if (c.parentUrl) catalogUrls.add(c.parentUrl)
    for (const url of c.previousUrls ?? []) catalogUrls.add(url)
  }
  return catalog
}

export function currentCatalogEntries(
  entries: DynamicCatalogEntry[],
): DynamicCatalogEntry[] {
  const superseded = new Set(entries.map((entry) => entry.parentUrl))
  return entries.filter((entry) => !superseded.has(entry.url))
}

export function resolveCatalogEntry(
  entries: DynamicCatalogEntry[],
  url: string,
): { entry: DynamicCatalogEntry; outdated: boolean } | null {
  const successorOf = (target: string) =>
    entries.find((entry) => entry.parentUrl === target)
  let entry =
    entries.find((item) => item.url === url) ??
    successorOf(url) ??
    entries.find((item) => item.previousUrls?.includes(url))
  if (!entry) return null
  const visited = new Set([entry.url])
  for (let next = successorOf(entry.url); next; next = successorOf(entry.url)) {
    if (visited.has(next.url)) break
    visited.add(next.url)
    entry = next
  }
  return { entry, outdated: entry.url !== url }
}

const URL_CONFLICT_CODE = 'DYNAMIC_COMPONENT_URL_CONFLICT'

export async function registerDynamicComponent(
  entry: DynamicCatalogEntry,
): Promise<void> {
  let catalog: DynamicCatalog
  try {
    catalog = await registerDynamicComponentEntry(entry)
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.code === URL_CONFLICT_CODE))
      throw error
    catalog = await getDynamicComponents()
  }
  primeDynamicCatalog(catalog)
  catalogUrls.add(entry.url)
}

export function primeDynamicCatalog(catalog: DynamicCatalog) {
  rememberCatalog(catalog)
  cachedCatalogPromise = Promise.resolve(catalog)
}

export function isAllowedDynamicUrl(url: string): boolean {
  // primary allowlist: exact membership in the fetched catalog (covers S3/CDN
  // hosted widgets whose origin differs from the API)
  if (catalogUrls.has(url)) return true
  try {
    const api = new URL(API_URL)
    const resolved = new URL(url, api.origin)
    return (
      resolved.origin === api.origin && resolved.pathname.includes('/objects/')
    )
  } catch {
    return false
  }
}

export function buildDynamicCatalogSystemMessage(
  catalog: DynamicCatalog,
): ChatMessage {
  const entries = currentCatalogEntries(catalog.components)
    .map(
      (c) =>
        `- ${c.name}: ${c.description}\n  url: ${c.url}\n  initial-height: ${c.initialHeight}\n  props schema: ${JSON.stringify(c.propsSchema)}`,
    )
    .join('\n')

  return {
    role: 'system',
    content: `## Dynamic Component Catalog\n\nThe following interactive components are available for <dynamic> nodes. Use exactly these URLs and the listed initial-height; props must conform to each schema. Reuse a listed component whenever it fits, passing the post's content through props, before writing a new one with preview_dynamic_component.\n\n${entries}`,
  }
}

function fetchDynamicCatalog(): Promise<DynamicCatalog | null> {
  cachedCatalogPromise ??= getDynamicComponents()
    .catch(() => null)
    .then(rememberCatalog)
  return cachedCatalogPromise
}

export async function resolveCatalogUrl(
  url: string,
): Promise<ReturnType<typeof resolveCatalogEntry>> {
  const catalog = await fetchDynamicCatalog()
  return catalog ? resolveCatalogEntry(catalog.components, url) : null
}

export async function reviseDynamicComponent(
  entry: DynamicCatalogEntry & { id: string },
  patch: DynamicCatalogEntryPatch,
): Promise<void> {
  primeDynamicCatalog(await updateDynamicComponentEntry(entry.id, patch))
}

export function useDynamicCatalog(): DynamicCatalog | null {
  const [catalog, setCatalog] = useState<DynamicCatalog | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchDynamicCatalog().then((next) => {
      if (!cancelled) setCatalog(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return catalog
}

export function useDynamicCatalogSystemMessages(): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchDynamicCatalog().then((catalog) => {
      if (cancelled || !catalog?.components?.length) return
      setMessages([buildDynamicCatalogSystemMessage(catalog)])
    })
    return () => {
      cancelled = true
    }
  }, [])

  return messages
}
