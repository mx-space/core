import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { ParsedRouteMetadata, ParsedSectionMeta } from './meta-parser'

import {
  MetaParseError,
  parsePageMetadata,
  parseSectionMeta,
} from './meta-parser'

const PAGE_FILE = 'page.tsx'
const PAGE_SYNC_FILE = 'page.sync.tsx'
const META_FILE = 'meta.ts'
const REDIRECTS_FILE = 'redirects.ts'
const GROUP_RE = /^\(([^)]+)\)$/
const DYNAMIC_RE = /^\[(.+)\]$/
const CATCH_ALL_RE = /^\[\.\.\.(.+)\]$/

export interface ScannedPage {
  filePath: string
  lazy: boolean
  url: string
  layout: 'shell' | 'public'
  section: string
  sectionIsGroup: boolean
  isTopLevel: boolean
  metadata: ParsedRouteMetadata
}

export interface ScannedSection {
  name: string
  isGroup: boolean
  layout: 'shell' | 'public'
  meta?: ParsedSectionMeta
  metaFilePath?: string
}

export interface ScanResult {
  pages: ScannedPage[]
  sections: ScannedSection[]
  redirectsFile: string | null
}

interface WalkContext {
  viewsRoot: string
  sections: Map<string, ScannedSection>
  pages: ScannedPage[]
}

function readSourceIfExists(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function urlSegmentFromDir(name: string): string | null {
  if (GROUP_RE.test(name)) return null
  const catchAll = CATCH_ALL_RE.exec(name)
  if (catchAll) return '*'
  const dyn = DYNAMIC_RE.exec(name)
  if (dyn) return `:${dyn[1]}`
  return name
}

function buildUrl(segments: string[]): string {
  const cleaned = segments
    .map(urlSegmentFromDir)
    .filter((seg): seg is string => seg !== null)
  return cleaned.length ? `/${cleaned.join('/')}` : '/'
}

function isDir(file: string): boolean {
  try {
    return statSync(file).isDirectory()
  } catch {
    return false
  }
}

function detectSection(
  segments: string[],
): { name: string; isGroup: boolean } | null {
  if (segments.length === 0) return null
  const first = segments[0]
  const groupMatch = GROUP_RE.exec(first)
  if (groupMatch) return { name: groupMatch[1], isGroup: true }
  return { name: first, isGroup: false }
}

function recordSection(
  ctx: WalkContext,
  dir: string,
  rawName: string,
  segmentsFromRoot: string[],
) {
  const section = detectSection(segmentsFromRoot)
  if (!section) return
  if (ctx.sections.has(section.name)) return
  const layout = section.name === 'public' ? 'public' : 'shell'
  const metaPath = join(dir, META_FILE)
  let meta: ParsedSectionMeta | undefined
  let metaFilePath: string | undefined
  if (existsSync(metaPath)) {
    const src = readSourceIfExists(metaPath)
    if (src !== null) {
      meta = parseSectionMeta(src, metaPath)
      metaFilePath = metaPath
    }
  }
  ctx.sections.set(section.name, {
    name: section.name,
    isGroup: section.isGroup,
    layout,
    meta,
    metaFilePath,
  })
}

function walk(ctx: WalkContext, dir: string, segments: string[]) {
  const entries = readdirSync(dir, { withFileTypes: true })

  // First, register section info if this is a top-level dir under views/
  if (segments.length === 1) {
    recordSection(ctx, dir, segments[0], segments)
  }

  // Collect page file in current dir (mutual exclusion check)
  const hasLazy = entries.some((e) => e.isFile() && e.name === PAGE_FILE)
  const hasSync = entries.some((e) => e.isFile() && e.name === PAGE_SYNC_FILE)
  if (hasLazy && hasSync) {
    throw new Error(
      `${dir}: cannot define both page.tsx and page.sync.tsx in the same directory`,
    )
  }
  if (hasLazy || hasSync) {
    const fileName = hasLazy ? PAGE_FILE : PAGE_SYNC_FILE
    const filePath = join(dir, fileName)
    const src = readFileSync(filePath, 'utf8')
    const metadata = parsePageMetadata(src, filePath)
    if (!metadata) {
      throw new MetaParseError(
        `${fileName} is missing the required 'metadata' export`,
        filePath,
      )
    }
    const url = buildUrl(segments)
    const sectionInfo = detectSection(segments)
    const layout = sectionInfo?.name === 'public' ? 'public' : 'shell'
    ctx.pages.push({
      filePath,
      lazy: hasLazy,
      url,
      layout,
      section: sectionInfo?.name ?? '__top__',
      sectionIsGroup: sectionInfo?.isGroup ?? false,
      isTopLevel: sectionInfo === null,
      metadata,
    })
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    walk(ctx, child, [...segments, entry.name])
  }
}

export function scanViews(viewsRoot: string): ScanResult {
  if (!isDir(viewsRoot)) {
    throw new Error(`views root not found: ${viewsRoot}`)
  }
  const ctx: WalkContext = {
    viewsRoot,
    sections: new Map(),
    pages: [],
  }

  for (const entry of readdirSync(viewsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    walk(ctx, join(viewsRoot, entry.name), [entry.name])
  }

  // Also pick up top-level page files (rare, but for completeness)
  // (views root never has a page.tsx in this project)

  const redirectsPath = join(viewsRoot, REDIRECTS_FILE)
  const redirectsFile = existsSync(redirectsPath) ? redirectsPath : null

  // Validate: duplicate URLs
  const seen = new Map<string, string>()
  for (const page of ctx.pages) {
    const existing = seen.get(page.url)
    if (existing) {
      throw new Error(
        `duplicate route ${page.url}: ${existing} and ${page.filePath}`,
      )
    }
    seen.set(page.url, page.filePath)
  }

  return {
    pages: ctx.pages,
    sections: Array.from(ctx.sections.values()),
    redirectsFile,
  }
}

export function relViews(viewsRoot: string, absPath: string): string {
  return relative(viewsRoot, absPath).split(sep).join('/')
}
