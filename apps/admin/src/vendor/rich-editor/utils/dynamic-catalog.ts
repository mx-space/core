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

export function isAllowedDynamicUrl(url: string): boolean {
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

function fetchDynamicCatalog(): Promise<DynamicCatalog | null> {
  // no-store beats the browser cache; the random query beats any CDN in
  // front of the API that ignores request cache directives
  cachedCatalogPromise ??= fetch(
    `${getDynamicCatalogUrl()}?_t=${Date.now()}`,
    { cache: 'no-store' },
  )
    .then((res) => (res.ok ? (res.json() as Promise<DynamicCatalog>) : null))
    .catch(() => null)
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
