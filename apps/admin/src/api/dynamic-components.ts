import { API_URL } from '~/constants/env'
import { SnippetType } from '~/models/snippet'

import { ApiRequestError } from './http'
import { createSnippet, getSnippetByPath, updateSnippet } from './snippets'

export interface DynamicCatalogEntry {
  id?: string
  parentUrl?: string
  previousUrls?: string[]
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

export type DynamicCatalogEntryPatch = Partial<
  Omit<DynamicCatalogEntry, 'id' | 'parentUrl' | 'previousUrls'>
> & { parentUrl?: string | null }

// Data snippet (admin-editable JSON) with this customPath. Snippets serve
// fresh on every edit; the file module's year-long strong cache would make
// a file-hosted catalog effectively immutable.
const CATALOG_SNIPPET_PATH = 'dynamic-widgets-catalog'

export function getDynamicCatalogUrl(): string {
  return `${API_URL}/s/${CATALOG_SNIPPET_PATH}`
}

export async function getDynamicComponents(): Promise<DynamicCatalog> {
  const snippet = await getSnippetByPath(CATALOG_SNIPPET_PATH)
  return snippet ? parseCatalog(snippet.raw) : { version: 1, components: [] }
}

export function registerDynamicComponentEntry(
  entry: DynamicCatalogEntry,
): Promise<DynamicCatalog> {
  return mutateCatalog((components) => {
    assertUrlFree(components, entry.url)
    return [...components, { ...entry, id: entry.id ?? crypto.randomUUID() }]
  })
}

export function updateDynamicComponentEntry(
  id: string,
  patch: DynamicCatalogEntryPatch,
): Promise<DynamicCatalog> {
  return mutateCatalog((components) => {
    const current = findEntry(components, id)
    const { parentUrl, ...fields } = patch
    const next: DynamicCatalogEntry = { ...current, ...fields }
    if (parentUrl === null) delete next.parentUrl
    else if (parentUrl !== undefined) next.parentUrl = parentUrl
    if (patch.url !== undefined && patch.url !== current.url) {
      assertUrlFree(
        components.filter((entry) => entry !== current),
        patch.url,
      )
      next.previousUrls = [
        ...(current.previousUrls ?? []).filter(
          (url) => url !== current.url && url !== patch.url,
        ),
        current.url,
      ]
    }
    return components.map((entry) => (entry === current ? next : entry))
  })
}

export function deleteDynamicComponentEntry(
  id: string,
): Promise<DynamicCatalog> {
  return mutateCatalog((components) => {
    const current = findEntry(components, id)
    return components.filter((entry) => entry !== current)
  })
}

// Read-modify-write on one snippet: the last concurrent writer wins. Every
// write persists the derived ids, so legacy entries keep a stable id once
// any entry changes.
async function mutateCatalog(
  mutate: (components: DynamicCatalogEntry[]) => DynamicCatalogEntry[],
): Promise<DynamicCatalog> {
  const snippet = await getSnippetByPath(CATALOG_SNIPPET_PATH)
  const catalog = snippet
    ? parseCatalog(snippet.raw)
    : { version: 1, components: [] }
  const next = { ...catalog, components: mutate(catalog.components) }
  const raw = JSON.stringify(next, null, 2)
  if (snippet)
    await updateSnippet(snippet.id, {
      raw,
      path: snippet.path,
      type: snippet.type,
    })
  else
    await createSnippet({
      path: CATALOG_SNIPPET_PATH,
      type: SnippetType.JSON,
      raw,
      private: false,
    })
  return next
}

function findEntry(components: DynamicCatalogEntry[], id: string) {
  const entry = components.find((item) => item.id === id)
  if (!entry)
    throw new ApiRequestError(
      'Dynamic component not found',
      'DYNAMIC_COMPONENT_NOT_FOUND',
      404,
    )
  return entry
}

function assertUrlFree(components: DynamicCatalogEntry[], url: string) {
  if (components.some((entry) => entry.url === url))
    throw new ApiRequestError(
      'A dynamic component with this URL already exists',
      'DYNAMIC_COMPONENT_URL_CONFLICT',
      409,
    )
}

function parseCatalog(raw: string): DynamicCatalog {
  const record = asRecord(JSON.parse(raw))
  if (!Array.isArray(record.components) || typeof record.version !== 'number') {
    throw new TypeError('Invalid dynamic component catalog')
  }
  return {
    components: record.components.map(parseEntry),
    version: record.version,
  }
}

function parseEntry(value: unknown): DynamicCatalogEntry {
  const record = asRecord(value)
  const url = String(record.url ?? '')
  return {
    ...record,
    id: typeof record.id === 'string' ? record.id : url,
    ...(Array.isArray(record.previousUrls)
      ? { previousUrls: record.previousUrls.map(String) }
      : {}),
    description: String(record.description ?? ''),
    initialHeight: Number(record.initialHeight ?? 0),
    name: String(record.name ?? ''),
    propsSchema: asRecord(record.propsSchema),
    url,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
