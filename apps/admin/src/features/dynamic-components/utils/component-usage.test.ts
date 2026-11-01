import { describe, expect, it } from 'vitest'

import type { ContentUsage } from '~/api/content-usage'
import type { DynamicCatalogEntry } from '~/api/dynamic-components'
import type { OrphanFile } from '~/api/files'

import { classifyDynamicComponents } from './component-usage'

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

function usage(url: string, extra: Partial<ContentUsage> = {}): ContentUsage {
  return {
    bytes: 1000,
    drafts: [],
    fileReferenceId: `ref-${url}`,
    historyOnly: false,
    other: [],
    published: [],
    url,
    ...extra,
  }
}

const post = { id: 'p1', title: 'Post', type: 'post' as const }
const draft = { documentId: 'd1', draftId: 'dr1', live: false, title: 'Draft' }
const snippet = { id: 's1', title: 'home', type: 'snippet' as const }

function orphan(fileUrl: string, byteSize = 500): OrphanFile {
  return {
    byteSize,
    createdAt: '2026-01-01T00:00:00Z',
    fileName: fileUrl.split('/').pop()!,
    fileUrl,
    id: `orphan-${fileUrl}`,
  }
}

function run(
  components: DynamicCatalogEntry[],
  usages: ContentUsage[],
  orphanFiles: OrphanFile[] = [],
) {
  return classifyDynamicComponents({
    catalog: { components, version: 1 },
    orphanFiles,
    usage: usages,
  })
}

describe('classifyDynamicComponents', () => {
  it('marks an entry used by a post as used and lists no candidate', () => {
    const a = entry('a')
    const report = run([a], [usage(a.url, { published: [post] })])
    expect(report.entries[0].status).toBe('used')
    expect(report.entries[0].publishedCount).toBe(1)
    expect(report.candidates.unusedEntries).toEqual([])
    expect(report.candidates.unusedVersions).toEqual([])
  })

  it('lists an unreferenced previous version while the entry stays used', () => {
    const old = `${base}a-old.js`
    const a = entry('a', { previousUrls: [old] })
    const report = run(
      [a],
      [usage(a.url, { published: [post] }), usage(old, { bytes: 300 })],
    )
    expect(report.entries[0].status).toBe('used')
    expect(report.entries[0].versions.map((v) => v.url)).toEqual([a.url, old])
    expect(report.candidates.unusedVersions).toMatchObject([
      {
        action: { entryId: 'a', type: 'previousUrl', url: old },
        bytes: 300,
        preChecked: true,
        urls: [old],
      },
    ])
  })

  it('lists an unreferenced entry superseded via parentUrl as an old version', () => {
    const parent = entry('parent')
    const child = entry('child', { parentUrl: parent.url })
    const report = run(
      [parent, child],
      [usage(parent.url), usage(child.url, { published: [post] })],
    )
    expect(report.candidates.unusedEntries).toEqual([])
    expect(report.candidates.unusedVersions).toMatchObject([
      { action: { entryId: 'parent', type: 'entry' }, urls: [parent.url] },
    ])
  })

  it('lists a draft-only entry without pre-checking it', () => {
    const a = entry('a')
    const report = run([a], [usage(a.url, { drafts: [draft] })])
    expect(report.entries[0].status).toBe('draftOnly')
    expect(report.candidates.draftOnly).toMatchObject([
      { action: { entryId: 'a', type: 'entry' }, preChecked: false },
    ])
    expect(report.candidates.unusedEntries).toEqual([])
  })

  it('lists an unreferenced previous version of a draft-only entry', () => {
    const old = `${base}a-old.js`
    const a = entry('a', { previousUrls: [old] })
    const report = run([a], [usage(a.url, { drafts: [draft] }), usage(old)])
    expect(report.entries[0].status).toBe('draftOnly')
    expect(report.candidates.unusedVersions).toMatchObject([
      { action: { entryId: 'a', type: 'previousUrl', url: old } },
    ])
  })

  it('keeps snippet-only and history-only entries out of cleanup', () => {
    const a = entry('a')
    const b = entry('b')
    const report = run(
      [a, b],
      [usage(a.url, { other: [snippet] }), usage(b.url, { historyOnly: true })],
    )
    expect(report.entries.map((e) => e.status)).toEqual([
      'otherOnly',
      'historyOnly',
    ])
    const { draftOnly, unregisteredFiles, unusedEntries, unusedVersions } =
      report.candidates
    expect([
      ...draftOnly,
      ...unregisteredFiles,
      ...unusedEntries,
      ...unusedVersions,
    ]).toEqual([])
  })

  it('pre-checks an entry nobody uses, with all its version files', () => {
    const old = `${base}a-old.js`
    const a = entry('a', { previousUrls: [old] })
    const report = run([a], [usage(a.url), usage(old, { bytes: 200 })])
    expect(report.entries[0].status).toBe('unused')
    expect(report.entries[0].bytes).toBe(1200)
    expect(report.candidates.unusedEntries).toMatchObject([
      {
        action: { entryId: 'a', type: 'entry' },
        bytes: 1200,
        fileReferenceIds: [`ref-${a.url}`, `ref-${old}`],
        preChecked: true,
        urls: [a.url, old],
      },
    ])
  })

  it('lists orphan version scripts outside the catalog and ignores other orphans', () => {
    const a = entry('a')
    const report = run(
      [a],
      [usage(a.url, { published: [post] })],
      [
        orphan(`${base}stray.js`, 700),
        orphan('https://object.innei.in/images/cover.png'),
        orphan(a.url),
      ],
    )
    expect(report.candidates.unregisteredFiles).toMatchObject([
      {
        action: null,
        bytes: 700,
        fileReferenceIds: [`orphan-${base}stray.js`],
        preChecked: true,
        urls: [`${base}stray.js`],
      },
    ])
  })

  it('sums reclaimable bytes over pre-checked candidates only', () => {
    const a = entry('a')
    const b = entry('b')
    const report = run(
      [a, b],
      [usage(a.url, { bytes: 400 }), usage(b.url, { drafts: [draft] })],
      [orphan(`${base}stray.js`, 600)],
    )
    expect(report.reclaimableBytes).toBe(1000)
  })
})
