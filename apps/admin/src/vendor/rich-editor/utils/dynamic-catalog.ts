import type { ChatMessage } from '@haklex/rich-agent-core'
import { useEffect, useState } from 'react'

import { API_URL } from '~/constants/env'

export interface DynamicCatalogEntry {
  description: string
  initialHeight: number
  name: string
  propsSchema: Record<string, unknown>
  url: string
}

export interface DynamicCatalog {
  components: DynamicCatalogEntry[]
  version: number
}

// Data snippet (admin-editable JSON) with this customPath. Snippets serve
// fresh on every edit; the file module's year-long strong cache would make
// a file-hosted catalog effectively immutable.
const CATALOG_SNIPPET_PATH = 'dynamic-widgets-catalog'

export function getDynamicCatalogUrl(): string {
  return `${API_URL}/s/${CATALOG_SNIPPET_PATH}`
}

const catalogUrls = new Set<string>()

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
  const entries = catalog.components
    .map(
      (c) =>
        `- ${c.name}: ${c.description}\n  url: ${c.url}\n  initial-height: ${c.initialHeight}\n  props schema: ${JSON.stringify(c.propsSchema)}`,
    )
    .join('\n')

  return {
    role: 'system',
    content: `## Dynamic Component Catalog\n\nThe following interactive components are available for <dynamic> nodes. Use exactly these URLs and the listed initial-height; props must conform to each schema.\n\n${entries}`,
  }
}

let cachedCatalogPromise: Promise<DynamicCatalog | null> | null = null

async function requestCatalog(url: string): Promise<DynamicCatalog | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as DynamicCatalog) : null
  } catch {
    return null
  }
}

function fetchDynamicCatalog(): Promise<DynamicCatalog | null> {
  // no-store beats the browser cache; the random query beats any CDN in
  // front of the API that ignores request cache directives. Servers
  // predating the snippet-route query-strip fix 404 on the query form, so
  // fall back to the bare URL.
  cachedCatalogPromise ??= requestCatalog(
    `${getDynamicCatalogUrl()}?_t=${Date.now()}`,
  )
    .then((catalog) => catalog ?? requestCatalog(getDynamicCatalogUrl()))
    .then((catalog) => {
      for (const c of catalog?.components ?? []) catalogUrls.add(c.url)
      return catalog
    })
  return cachedCatalogPromise
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
