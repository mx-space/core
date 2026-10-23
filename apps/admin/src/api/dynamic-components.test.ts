// @vitest-environment node

import { beforeEach, expect, it, vi } from 'vitest'

import {
  deleteDynamicComponentEntry,
  getDynamicComponents,
  registerDynamicComponentEntry,
  updateDynamicComponentEntry,
} from './dynamic-components'

const getSnippetByPath = vi.fn()
const createSnippet = vi.fn()
const updateSnippet = vi.fn()
vi.mock('~/constants/env', () => ({ API_URL: 'https://api.example' }))
vi.mock('./snippets', () => ({
  getSnippetByPath: (...args: unknown[]) => getSnippetByPath(...args),
  createSnippet: (...args: unknown[]) => createSnippet(...args),
  updateSnippet: (...args: unknown[]) => updateSnippet(...args),
}))

const chart = {
  name: 'Chart',
  description: 'A chart',
  url: 'https://cdn.example/chart.js',
  initialHeight: 240,
  propsSchema: { properties: { max_count: { type: 'number' } } },
}

function storeCatalog(components: unknown[]) {
  getSnippetByPath.mockResolvedValue({
    id: 'catalog',
    path: 'dynamic-widgets-catalog',
    type: 'json',
    raw: JSON.stringify({ version: 1, components }),
  })
}

function writtenCatalog() {
  const [id, body] = updateSnippet.mock.calls.at(-1)!
  expect(id).toBe('catalog')
  expect(body.path).toBe('dynamic-widgets-catalog')
  return JSON.parse(body.raw)
}

beforeEach(() => vi.resetAllMocks())

it('reads the catalog snippet and gives legacy entries their url as id', async () => {
  storeCatalog([chart])

  const catalog = await getDynamicComponents()

  expect(getSnippetByPath).toHaveBeenCalledWith('dynamic-widgets-catalog')
  expect(catalog.components).toEqual([{ ...chart, id: chart.url }])
})

it('treats a missing catalog snippet as an empty catalog', async () => {
  getSnippetByPath.mockResolvedValue(null)

  await expect(getDynamicComponents()).resolves.toEqual({
    version: 1,
    components: [],
  })
})

it('creates a public catalog snippet on the first registration', async () => {
  getSnippetByPath.mockResolvedValue(null)

  await registerDynamicComponentEntry(chart)

  const body = createSnippet.mock.calls[0][0]
  expect(body).toMatchObject({
    path: 'dynamic-widgets-catalog',
    private: false,
    type: 'json',
  })
  expect(JSON.parse(body.raw).components).toEqual([
    { ...chart, id: expect.any(String) },
  ])
})

it('rejects registering a url that is already in the catalog', async () => {
  storeCatalog([chart])

  await expect(registerDynamicComponentEntry(chart)).rejects.toMatchObject({
    code: 'DYNAMIC_COMPONENT_URL_CONFLICT',
    status: 409,
  })
  expect(updateSnippet).not.toHaveBeenCalled()
})

it('never overwrites a malformed catalog', async () => {
  getSnippetByPath.mockResolvedValue({
    id: 'catalog',
    raw: '{"components":"invalid","version":1}',
  })

  await expect(registerDynamicComponentEntry(chart)).rejects.toThrow(
    'Invalid dynamic component catalog',
  )
  expect(updateSnippet).not.toHaveBeenCalled()
})

it('updates an entry in place and keeps the ids of untouched legacy entries', async () => {
  const other = { ...chart, name: 'Other', url: 'https://cdn.example/o.js' }
  storeCatalog([{ ...chart, id: 'chart' }, other])

  const catalog = await updateDynamicComponentEntry('chart', {
    description: 'Updated',
  })

  expect(writtenCatalog().components).toEqual([
    { ...chart, id: 'chart', description: 'Updated' },
    { ...other, id: other.url },
  ])
  expect(catalog.components[0].description).toBe('Updated')
})

it('records every replaced url in previousUrls, newest last', async () => {
  storeCatalog([{ ...chart, id: 'chart', previousUrls: ['https://v0.js'] }])

  await updateDynamicComponentEntry('chart', {
    url: 'https://v2.js',
    parentUrl: chart.url,
  })

  expect(writtenCatalog().components[0]).toMatchObject({
    url: 'https://v2.js',
    parentUrl: chart.url,
    previousUrls: ['https://v0.js', chart.url],
  })
})

it('drops a url from previousUrls when the entry moves back to it', async () => {
  storeCatalog([
    { ...chart, id: 'chart', url: 'https://v2.js', previousUrls: [chart.url] },
  ])

  await updateDynamicComponentEntry('chart', { url: chart.url })

  expect(writtenCatalog().components[0].previousUrls).toEqual(['https://v2.js'])
})

it('clears parentUrl when the patch sets it to null', async () => {
  storeCatalog([{ ...chart, id: 'chart', parentUrl: 'https://v0.js' }])

  await updateDynamicComponentEntry('chart', { parentUrl: null })

  expect(writtenCatalog().components[0]).not.toHaveProperty('parentUrl')
})

it('rejects moving an entry onto a url another entry uses', async () => {
  const other = { ...chart, id: 'other', url: 'https://cdn.example/o.js' }
  storeCatalog([{ ...chart, id: 'chart' }, other])

  await expect(
    updateDynamicComponentEntry('chart', { url: other.url }),
  ).rejects.toMatchObject({ code: 'DYNAMIC_COMPONENT_URL_CONFLICT' })
})

it('reports a missing entry on update and delete', async () => {
  storeCatalog([{ ...chart, id: 'chart' }])

  await expect(
    updateDynamicComponentEntry('nope', { name: 'x' }),
  ).rejects.toMatchObject({ code: 'DYNAMIC_COMPONENT_NOT_FOUND', status: 404 })
  await expect(deleteDynamicComponentEntry('nope')).rejects.toMatchObject({
    code: 'DYNAMIC_COMPONENT_NOT_FOUND',
  })
})

it('deletes an entry by id', async () => {
  const other = { ...chart, id: 'other', url: 'https://cdn.example/o.js' }
  storeCatalog([{ ...chart, id: 'chart' }, other])

  const catalog = await deleteDynamicComponentEntry('chart')

  expect(writtenCatalog().components).toEqual([other])
  expect(catalog.components).toEqual([other])
})
