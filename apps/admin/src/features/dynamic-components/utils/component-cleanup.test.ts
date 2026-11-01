import { describe, expect, it } from 'vitest'

import type { ContentUsage } from '~/api/content-usage'
import type {
  DynamicCatalog,
  DynamicCatalogEntry,
} from '~/api/dynamic-components'

import type { ComponentCleanupDeps } from './component-cleanup'
import { runComponentCleanup } from './component-cleanup'
import type { ComponentCleanupCandidate } from './component-usage'

const base = 'https://object.innei.in/versions/'

function entry(
  id: string,
  extra: Partial<DynamicCatalogEntry> = {},
): DynamicCatalogEntry {
  return {
    description: '',
    id,
    initialHeight: 200,
    name: id,
    propsSchema: {},
    url: `${base}${id}.js`,
    ...extra,
  }
}

function fakes(
  components: DynamicCatalogEntry[],
  options: {
    skip?: string[]
    usedOnRecheck?: string[]
  } = {},
) {
  let catalog: DynamicCatalog = {
    components: structuredClone(components),
    version: 1,
  }
  const existing = new Set<string>()
  const refOf = (url: string) => `ref-${url}`
  const urlOfRef = (ref: string) => ref.slice(4)
  const deleteCalls: string[][] = []
  const register = (url: string) => existing.add(url)
  const deps: ComponentCleanupDeps = {
    deleteFiles: async (ids) => {
      deleteCalls.push(ids)
      let deletedCount = 0
      for (const id of ids) {
        const url = urlOfRef(id)
        if (options.skip?.includes(url)) continue
        existing.delete(url)
        deletedCount++
      }
      return { deletedCount }
    },
    getUsage: async (urls) =>
      urls.map((url): ContentUsage => ({
        bytes: 100,
        drafts: [],
        fileReferenceId: existing.has(url) ? refOf(url) : null,
        historyOnly: false,
        other: [],
        published: options.usedOnRecheck?.includes(url)
          ? [{ id: 'p1', title: 'Post', type: 'post' }]
          : [],
        url,
      })),
    mutateCatalog: async (mutate) => {
      catalog = {
        ...catalog,
        components: mutate(structuredClone(catalog.components)),
      }
      return catalog
    },
  }
  return {
    catalog: () => catalog,
    deleteCalls,
    deps,
    refOf,
    register,
  }
}

function entryCandidate(
  target: DynamicCatalogEntry,
): ComponentCleanupCandidate {
  const urls = [target.url, ...(target.previousUrls ?? [])]
  return {
    action: { entryId: target.id!, type: 'entry' },
    bytes: 100,
    fileReferenceIds: urls.map((url) => `ref-${url}`),
    group: 'unusedEntries',
    key: `entry:${target.id}`,
    label: target.name,
    preChecked: true,
    urls,
  }
}

describe('runComponentCleanup', () => {
  it('drops a selection that became used and leaves it in the catalog', async () => {
    const a = entry('a')
    const env = fakes([a], { usedOnRecheck: [a.url] })
    env.register(a.url)
    const result = await runComponentCleanup([entryCandidate(a)], env.deps)
    expect(result.dropped.map((item) => item.key)).toEqual(['entry:a'])
    expect(result.deleted).toEqual([])
    expect(env.catalog().components).toEqual([a])
    expect(env.deleteCalls).toEqual([])
  })

  it('removes a previous version from the stored catalog', async () => {
    const old = `${base}a-old.js`
    const a = entry('a', { previousUrls: [old] })
    const env = fakes([a])
    env.register(old)
    const result = await runComponentCleanup(
      [
        {
          action: { entryId: 'a', type: 'previousUrl', url: old },
          bytes: 100,
          fileReferenceIds: [`ref-${old}`],
          group: 'unusedVersions',
          key: `version:a:${old}`,
          label: 'a',
          preChecked: true,
          urls: [old],
        },
      ],
      env.deps,
    )
    expect(result.deleted.map((item) => item.key)).toEqual([`version:a:${old}`])
    expect(env.catalog().components).toEqual([{ ...a, previousUrls: [] }])
    expect(env.deleteCalls).toEqual([[`ref-${old}`]])
  })

  it('restores an entry the server refused to delete at its original position', async () => {
    const a = entry('a')
    const b = entry('b')
    const c = entry('c')
    const env = fakes([a, b, c], { skip: [b.url] })
    env.register(a.url)
    env.register(b.url)
    const result = await runComponentCleanup(
      [entryCandidate(a), entryCandidate(b)],
      env.deps,
    )
    expect(result.deleted.map((item) => item.key)).toEqual(['entry:a'])
    expect(result.restored.map((item) => item.key)).toEqual(['entry:b'])
    expect(env.catalog().components.map((item) => item.id)).toEqual(['b', 'c'])
  })

  it('deletes unregistered files without touching the catalog', async () => {
    const a = entry('a')
    const stray = `${base}stray.js`
    const env = fakes([a])
    env.register(stray)
    const result = await runComponentCleanup(
      [
        {
          action: null,
          bytes: 100,
          fileReferenceIds: ['orphan-row-1'],
          group: 'unregisteredFiles',
          key: 'file:orphan-row-1',
          label: 'stray.js',
          preChecked: true,
          urls: [stray],
        },
      ],
      {
        ...env.deps,
        deleteFiles: async (ids) => {
          env.deleteCalls.push(ids)
          return env.deps.deleteFiles([env.refOf(stray)])
        },
      },
    )
    expect(env.deleteCalls[0]).toEqual(['orphan-row-1'])
    expect(result.deleted.map((item) => item.key)).toEqual([
      'file:orphan-row-1',
    ])
    expect(env.catalog().components).toEqual([a])
  })

  it('drops an entry whose versions changed since it was listed', async () => {
    const listed = entry('chart')
    const revised = entry('chart', {
      previousUrls: [listed.url],
      url: `${base}chart-v2.js`,
    })
    const env = fakes([revised])
    env.register(listed.url)
    const result = await runComponentCleanup([entryCandidate(listed)], env.deps)
    expect(result.dropped.map((item) => item.key)).toEqual(['entry:chart'])
    expect(env.catalog().components).toEqual([revised])
    expect(env.deleteCalls).toEqual([])
  })

  it('restores several skipped previous versions in their original order', async () => {
    const [u1, u2, u3] = ['u1', 'u2', 'u3'].map((name) => `${base}${name}.js`)
    const a = entry('a', { previousUrls: [u1, u2, u3] })
    const env = fakes([a], { skip: [u1, u2] })
    env.register(u1)
    env.register(u2)
    const version = (url: string): ComponentCleanupCandidate => ({
      action: { entryId: 'a', type: 'previousUrl', url },
      bytes: 100,
      fileReferenceIds: [`ref-${url}`],
      group: 'unusedVersions',
      key: `version:a:${url}`,
      label: 'a',
      preChecked: true,
      urls: [url],
    })
    await runComponentCleanup([version(u1), version(u2)], env.deps)
    expect(env.catalog().components[0].previousUrls).toEqual([u1, u2, u3])
  })

  it('clears a parentUrl pointing at a deleted entry and restores it on skip', async () => {
    const parent = entry('parent')
    const child = entry('child', { parentUrl: parent.url })
    const deleted = fakes([parent, child])
    deleted.register(parent.url)
    await runComponentCleanup([entryCandidate(parent)], deleted.deps)
    expect(deleted.catalog().components).toEqual([
      { ...child, parentUrl: undefined },
    ])

    const skipped = fakes([parent, child], { skip: [parent.url] })
    skipped.register(parent.url)
    await runComponentCleanup([entryCandidate(parent)], skipped.deps)
    expect(skipped.catalog().components).toEqual([parent, child])
  })
})
