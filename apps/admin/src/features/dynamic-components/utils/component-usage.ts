import type { ContentUsage } from '~/api/content-usage'
import type {
  DynamicCatalog,
  DynamicCatalogEntry,
} from '~/api/dynamic-components'
import type { OrphanFile } from '~/api/files'

export type ComponentUsageStatus =
  'draftOnly' | 'historyOnly' | 'otherOnly' | 'unused' | 'used'

export interface ComponentVersionReport {
  bytes: number
  current: boolean
  status: ComponentUsageStatus
  url: string
  usage: ContentUsage | null
}

export interface ComponentEntryReport {
  bytes: number
  entry: DynamicCatalogEntry
  entryId: string
  publishedCount: number
  status: ComponentUsageStatus
  versions: ComponentVersionReport[]
}

export type CatalogRemoval =
  | { entryId: string; type: 'entry' }
  | { entryId: string; type: 'previousUrl'; url: string }

export type CleanupGroup =
  'draftOnly' | 'unregisteredFiles' | 'unusedEntries' | 'unusedVersions'

export interface ComponentCleanupCandidate {
  action: CatalogRemoval | null
  bytes: number
  fileReferenceIds: string[]
  group: CleanupGroup
  key: string
  label: string
  preChecked: boolean
  urls: string[]
}

export interface ComponentUsageReport {
  candidates: Record<CleanupGroup, ComponentCleanupCandidate[]>
  entries: ComponentEntryReport[]
  reclaimableBytes: number
}

const VERSION_SCRIPT_PATH = /\/versions\/[^/]+\.js$/

export function entryIdOf(entry: DynamicCatalogEntry) {
  return entry.id ?? entry.url
}

export function usageStatus(usages: Array<ContentUsage | null>) {
  if (usages.some((usage) => usage === null || usage.published.length > 0))
    return 'used'
  const known = usages as ContentUsage[]
  if (known.some((usage) => usage.drafts.length > 0)) return 'draftOnly'
  if (known.some((usage) => usage.other.length > 0)) return 'otherOnly'
  if (known.some((usage) => usage.historyOnly)) return 'historyOnly'
  return 'unused'
}

export function classifyDynamicComponents(input: {
  catalog: DynamicCatalog
  orphanFiles: OrphanFile[]
  usage: ContentUsage[]
}): ComponentUsageReport {
  const byUrl = new Map(input.usage.map((usage) => [usage.url, usage]))
  const parentUrls = new Set(
    input.catalog.components.flatMap((entry) =>
      entry.parentUrl ? [entry.parentUrl] : [],
    ),
  )
  const catalogUrls = new Set<string>()
  const candidates: ComponentUsageReport['candidates'] = {
    draftOnly: [],
    unregisteredFiles: [],
    unusedEntries: [],
    unusedVersions: [],
  }

  const entries = input.catalog.components.map((entry) => {
    const entryId = entryIdOf(entry)
    const versions = [entry.url, ...(entry.previousUrls ?? [])].map(
      (url, index): ComponentVersionReport => {
        catalogUrls.add(url)
        const usage = byUrl.get(url) ?? null
        return {
          bytes: usage?.bytes ?? 0,
          current: index === 0,
          status: usageStatus([usage]),
          url,
          usage,
        }
      },
    )
    const report: ComponentEntryReport = {
      bytes: sum(versions.map((version) => version.bytes)),
      entry,
      entryId,
      publishedCount: countPublished(versions),
      status: usageStatus(versions.map((version) => version.usage)),
      versions,
    }

    if (report.status === 'unused' || report.status === 'draftOnly') {
      const group =
        report.status === 'draftOnly'
          ? 'draftOnly'
          : parentUrls.has(entry.url)
            ? 'unusedVersions'
            : 'unusedEntries'
      candidates[group].push(
        candidate(group, `entry:${entryId}`, entry.name, versions, {
          entryId,
          type: 'entry',
        }),
      )
    }
    if (report.status !== 'unused') {
      for (const version of versions.slice(1)) {
        if (version.status !== 'unused') continue
        candidates.unusedVersions.push(
          candidate(
            'unusedVersions',
            `version:${entryId}:${version.url}`,
            entry.name,
            [version],
            { entryId, type: 'previousUrl', url: version.url },
          ),
        )
      }
    }
    return report
  })

  for (const file of input.orphanFiles) {
    if (catalogUrls.has(file.fileUrl) || !isVersionScript(file.fileUrl))
      continue
    candidates.unregisteredFiles.push({
      action: null,
      bytes: file.byteSize ?? 0,
      fileReferenceIds: [file.id],
      group: 'unregisteredFiles',
      key: `file:${file.id}`,
      label: file.fileName,
      preChecked: true,
      urls: [file.fileUrl],
    })
  }

  const reclaimableBytes = sum(
    Object.values(candidates)
      .flat()
      .filter((item) => item.preChecked)
      .map((item) => item.bytes),
  )
  return { candidates, entries, reclaimableBytes }
}

function candidate(
  group: CleanupGroup,
  key: string,
  label: string,
  versions: ComponentVersionReport[],
  action: CatalogRemoval,
): ComponentCleanupCandidate {
  return {
    action,
    bytes: sum(versions.map((version) => version.bytes)),
    fileReferenceIds: versions.flatMap((version) =>
      version.usage?.fileReferenceId ? [version.usage.fileReferenceId] : [],
    ),
    group,
    key,
    label,
    preChecked: group !== 'draftOnly',
    urls: versions.map((version) => version.url),
  }
}

function countPublished(versions: ComponentVersionReport[]) {
  const seen = new Set<string>()
  for (const version of versions)
    for (const item of version.usage?.published ?? [])
      seen.add(`${item.type}:${item.id}`)
  return seen.size
}

function isVersionScript(fileUrl: string) {
  try {
    return VERSION_SCRIPT_PATH.test(new URL(fileUrl).pathname)
  } catch {
    return VERSION_SCRIPT_PATH.test(fileUrl)
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
