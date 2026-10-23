// @vitest-environment node

import { beforeEach, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import {
  buildDynamicCatalogSystemMessage,
  currentCatalogEntries,
  isAllowedDynamicUrl,
  registerDynamicComponent,
  resolveCatalogEntry,
} from './dynamic-catalog'

const registerDynamicComponentEntry = vi.fn()
vi.mock('~/constants/env', () => ({ API_URL: 'https://api.example' }))
vi.mock('~/api/dynamic-components', () => ({
  getDynamicComponents: vi.fn(),
  registerDynamicComponentEntry: (...args: unknown[]) =>
    registerDynamicComponentEntry(...args),
}))

const entry = {
  name: 'Counter',
  description: 'Counter',
  url: 'https://cdn.example/counter.js',
  initialHeight: 320,
  propsSchema: {},
}

beforeEach(() => vi.resetAllMocks())

it('registers through the catalog snippet and allows every catalog url it returns', async () => {
  const existing = {
    ...entry,
    name: 'Existing',
    url: 'https://cdn.example/existing.js',
  }
  registerDynamicComponentEntry.mockResolvedValue({
    version: 1,
    components: [existing, entry],
  })

  expect(isAllowedDynamicUrl(entry.url)).toBe(false)
  await registerDynamicComponent(entry)

  expect(registerDynamicComponentEntry).toHaveBeenCalledWith(entry)
  expect(isAllowedDynamicUrl(entry.url)).toBe(true)
  expect(isAllowedDynamicUrl(existing.url)).toBe(true)
})

it('propagates a failed registration without allowing the url', async () => {
  const rejected = { ...entry, url: 'https://cdn.example/rejected.js' }
  registerDynamicComponentEntry.mockRejectedValue(new Error('boom'))

  await expect(registerDynamicComponent(rejected)).rejects.toThrow('boom')
  expect(isAllowedDynamicUrl(rejected.url)).toBe(false)
})

it('treats a url that is already registered as registered', async () => {
  const getDynamicComponents = vi.mocked(
    (await import('~/api/dynamic-components')).getDynamicComponents,
  )
  const retried = { ...entry, url: 'https://cdn.example/retried.js' }
  registerDynamicComponentEntry.mockRejectedValueOnce(
    new ApiRequestError('Taken', 'DYNAMIC_COMPONENT_URL_CONFLICT', 409),
  )
  getDynamicComponents.mockResolvedValueOnce({
    version: 1,
    components: [retried],
  })

  await registerDynamicComponent(retried)

  expect(isAllowedDynamicUrl(retried.url)).toBe(true)
})

it('allows same-origin object storage urls without a catalog entry', () => {
  expect(isAllowedDynamicUrl('https://api.example/objects/widget.js')).toBe(
    true,
  )
  expect(isAllowedDynamicUrl('https://evil.example/objects/widget.js')).toBe(
    false,
  )
})

it('allows the previous version of a catalog entry so older posts keep rendering', async () => {
  registerDynamicComponentEntry.mockResolvedValue({
    version: 1,
    components: [
      {
        ...entry,
        url: 'https://cdn.example/counter-v2.js',
        parentUrl: 'https://cdn.example/counter-v1.js',
      },
    ],
  })

  await registerDynamicComponent(entry)

  expect(isAllowedDynamicUrl('https://cdn.example/counter-v1.js')).toBe(true)
})

const v1 = { ...entry, name: 'Chart', url: 'https://cdn.example/chart-1.js' }
const v2 = {
  ...v1,
  name: 'Chart 2',
  url: 'https://cdn.example/chart-2.js',
  parentUrl: v1.url,
}
const v3 = {
  ...v1,
  name: 'Chart 3',
  url: 'https://cdn.example/chart-3.js',
  parentUrl: v2.url,
}
const other = { ...entry, name: 'Map', url: 'https://cdn.example/map.js' }

it('lists only entries that no other entry supersedes', () => {
  expect(currentCatalogEntries([v1, v2, v3, other])).toEqual([v3, other])
})

it('resolves a current url to its own entry', () => {
  expect(resolveCatalogEntry([v1, v2, v3, other], other.url)).toEqual({
    entry: other,
    outdated: false,
  })
})

it('resolves an older version row to the newest entry in its chain', () => {
  expect(resolveCatalogEntry([v1, v2, v3], v1.url)).toEqual({
    entry: v3,
    outdated: true,
  })
})

it('resolves a url kept only as a parentUrl after in-place saves', () => {
  const saved = {
    ...v1,
    url: 'https://cdn.example/chart-9.js',
    parentUrl: 'https://cdn.example/chart-8.js',
  }
  expect(
    resolveCatalogEntry([saved], 'https://cdn.example/chart-8.js'),
  ).toEqual({
    entry: saved,
    outdated: true,
  })
})

it('returns null for a url the catalog does not know', () => {
  expect(
    resolveCatalogEntry([v1, v2], 'https://cdn.example/unknown.js'),
  ).toBeNull()
})

it('resolves a url kept in previousUrls after several saves', () => {
  const saved = {
    ...v1,
    url: 'https://cdn.example/chart-9.js',
    parentUrl: 'https://cdn.example/chart-8.js',
    previousUrls: [
      'https://cdn.example/chart-7.js',
      'https://cdn.example/chart-8.js',
    ],
  }
  expect(
    resolveCatalogEntry([saved], 'https://cdn.example/chart-7.js'),
  ).toEqual({
    entry: saved,
    outdated: true,
  })
})

it('allows every earlier url kept in previousUrls', async () => {
  registerDynamicComponentEntry.mockResolvedValue({
    version: 1,
    components: [
      {
        ...entry,
        url: 'https://cdn.example/gauge-3.js',
        previousUrls: ['https://cdn.example/gauge-1.js'],
      },
    ],
  })

  await registerDynamicComponent(entry)

  expect(isAllowedDynamicUrl('https://cdn.example/gauge-1.js')).toBe(true)
})

it('stops on a parentUrl cycle', () => {
  const a = {
    ...v1,
    url: 'https://cdn.example/a.js',
    parentUrl: 'https://cdn.example/b.js',
  }
  const b = {
    ...v1,
    url: 'https://cdn.example/b.js',
    parentUrl: 'https://cdn.example/a.js',
  }
  expect(resolveCatalogEntry([a, b], a.url)?.entry.url).toMatch(/[ab]\.js$/)
})

it('lists only current versions in the agent catalog and asks it to reuse them', () => {
  const message = buildDynamicCatalogSystemMessage({
    version: 1,
    components: [v1, v2, v3, other],
  })
  const content = 'content' in message ? String(message.content) : ''

  expect(content).toContain(v3.url)
  expect(content).toContain(other.url)
  expect(content).not.toContain(`url: ${v1.url}`)
  expect(content).not.toContain(`url: ${v2.url}`)
  expect(content).toMatch(/reuse/i)
})
