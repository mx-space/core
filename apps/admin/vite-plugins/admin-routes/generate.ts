import { sep } from 'node:path'

import type { ScannedPage, ScannedSection, ScanResult } from './scan'

interface GenerateOptions {
  viewsRoot: string
  isDev: boolean
}

interface RouteEntry {
  bindingId: string
  page: ScannedPage
  sourcePath: string
}

// absolute specifiers, not `~` alias: the tsconfig-paths resolution behind
// the alias is skipped for imports issued from a \0-virtual module since
// vite 8.1 / rolldown 1.1.3
function toViewImportPath(_viewsRoot: string, absPath: string): string {
  return absPath.split(sep).join('/')
}

function escapeString(value: string): string {
  return JSON.stringify(value)
}

function escapeArray(values: string[]): string {
  return `[${values.map(escapeString).join(', ')}]`
}

function renderRouteRecord(
  binding: string,
  page: ScannedPage,
  pathOverride?: string,
  childBindings?: string[],
): string {
  const m = page.metadata
  const parts: string[] = [
    `path: ${escapeString(pathOverride ?? page.url)}`,
    `element: ${binding}`,
  ]
  if (m.titleKey) {
    parts.push(`titleKey: ${escapeString(m.titleKey)}`)
  }
  if (m.descriptionKey) {
    parts.push(`descriptionKey: ${escapeString(m.descriptionKey)}`)
  }
  if (m.iconName) {
    parts.push(`icon: ${m.iconName}`)
  }
  if (m.matchPaths?.length) {
    parts.push(`matchPaths: ${escapeArray(m.matchPaths)}`)
  }
  parts.push(`layout: ${escapeString(page.layout)}`)
  if (m.hidden) {
    parts.push(`hidden: true`)
  }
  if (childBindings && childBindings.length > 0) {
    parts.push(`children: [${childBindings.join(', ')}]`)
  }
  return `{ ${parts.join(', ')} }`
}

function relativeChildPath(parentUrl: string, childUrl: string): string {
  if (parentUrl === '/' || parentUrl === '') return childUrl.replace(/^\//, '')
  if (childUrl.startsWith(`${parentUrl}/`)) {
    return childUrl.slice(parentUrl.length + 1)
  }
  return childUrl
}

interface ShellTreeNode {
  entry: RouteEntry
  children: ShellTreeNode[]
}

function buildShellRouteTree(shellEntries: RouteEntry[]): ShellTreeNode[] {
  const byUrl = new Map<string, ShellTreeNode>()
  for (const entry of shellEntries) {
    byUrl.set(entry.page.url, { entry, children: [] })
  }
  const roots: ShellTreeNode[] = []
  const sorted = [...shellEntries].sort((a, b) => {
    const da = a.page.url.split('/').length
    const db = b.page.url.split('/').length
    if (da !== db) return da - db
    return a.page.url.localeCompare(b.page.url)
  })
  for (const entry of sorted) {
    const node = byUrl.get(entry.page.url)!
    const segs = entry.page.url.split('/').filter(Boolean)
    // 视为 nested child 之条件：
    //   1. 尾段皆 dynamic-param（如 /foo/:id 自动 nest 入 /foo），或
    //   2. metadata.nested === true（显式 opt-in，覆 default 之 sibling 语义）。
    // 静态名子路（如 /files/comment-images 之于 /files）默认为独立 sibling route，
    // 而非父之 React Router child（否则父之 layout chrome 会包裹其内）。
    let parent: ShellTreeNode | null = null
    for (let n = segs.length - 1; n > 0; n--) {
      const prefix = `/${segs.slice(0, n).join('/')}`
      if (byUrl.has(prefix) && prefix !== entry.page.url) {
        const tailSegments = segs.slice(n)
        const allDynamic = tailSegments.every(
          (s) => s.startsWith(':') || s === '*',
        )
        const optedIn = entry.page.metadata.nested === true
        if (allDynamic || optedIn) parent = byUrl.get(prefix)!
        break
      }
    }
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

interface TreeNode {
  entry: RouteEntry
  children: TreeNode[]
}

function buildSectionTree(entries: RouteEntry[]): TreeNode[] {
  const byUrl = new Map<string, TreeNode>()
  for (const entry of entries) {
    byUrl.set(entry.page.url, { entry, children: [] })
  }
  const roots: TreeNode[] = []
  // Sort entries by URL depth (shallow first) for deterministic processing
  const sorted = [...entries].sort((a, b) => {
    const da = a.page.url.split('/').length
    const db = b.page.url.split('/').length
    if (da !== db) return da - db
    return a.page.url.localeCompare(b.page.url)
  })
  for (const entry of sorted) {
    const node = byUrl.get(entry.page.url)!
    const segs = entry.page.url.split('/').filter(Boolean)
    let parent: TreeNode | null = null
    for (let n = segs.length - 1; n > 0; n--) {
      const prefix = `/${segs.slice(0, n).join('/')}`
      if (byUrl.has(prefix) && prefix !== entry.page.url) {
        parent = byUrl.get(prefix)!
        break
      }
    }
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function sortByOrder<T extends { metadata: { order?: number }; url: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const oa = a.metadata.order ?? 999
    const ob = b.metadata.order ?? 999
    if (oa !== ob) return oa - ob
    return a.url.localeCompare(b.url)
  })
}

function renderSidebarNode(node: TreeNode): string {
  const sortedChildren = sortByOrder(
    node.children
      .map((child) => child.entry.page)
      .filter(
        (p) =>
          !p.metadata.hidden && !p.url.includes(':') && !p.url.includes('*'),
      ),
  )
  const childMap = new Map(node.children.map((c) => [c.entry.page.url, c]))
  const children = sortedChildren
    .map((p) => childMap.get(p.url))
    .filter((c): c is TreeNode => Boolean(c))
  if (children.length === 0) {
    return `{ route: ${node.entry.bindingId}_r }`
  }
  return `{ route: ${node.entry.bindingId}_r, children: [${children
    .map(renderSidebarNode)
    .join(', ')}] }`
}

export function generateModule(
  scan: ScanResult,
  options: GenerateOptions,
): string {
  const { viewsRoot, isDev } = options

  // Filter out (dev) section in production
  const pages = scan.pages.filter((page) => {
    if (page.section === 'dev' && page.sectionIsGroup && !isDev) return false
    if (page.section === 'dev' && !page.sectionIsGroup && !isDev) return false
    return true
  })

  // Allocate stable binding ids
  const sortedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url))
  const entries: RouteEntry[] = sortedPages.map((page, index) => ({
    bindingId: `P${index}`,
    page,
    sourcePath: toViewImportPath(viewsRoot, page.filePath),
  }))

  // Lucide icon imports
  const iconNames = new Set<string>()
  for (const entry of entries) {
    if (entry.page.metadata.iconName) {
      iconNames.add(entry.page.metadata.iconName)
    }
  }

  // Build sections (only those that have at least one page)
  const sectionByName = new Map<string, ScannedSection>()
  for (const section of scan.sections) {
    sectionByName.set(section.name, section)
  }
  const sectionsWithPages = new Map<string, RouteEntry[]>()
  for (const entry of entries) {
    if (entry.page.layout === 'public') continue
    const key = entry.page.section
    if (!sectionsWithPages.has(key)) sectionsWithPages.set(key, [])
    sectionsWithPages.get(key)!.push(entry)
  }

  const lines: string[] = [
    `// generated by admin-routes plugin — do not edit`,
    `import { lazy } from 'react'`,
  ]
  if (iconNames.size) {
    lines.push(
      `import { ${[...iconNames].sort().join(', ')} } from 'lucide-react'`,
    )
  }
  // Sync imports
  for (const entry of entries) {
    if (entry.page.lazy) continue
    lines.push(`import ${entry.bindingId} from '${entry.sourcePath}'`)
  }
  // Lazy bindings
  for (const entry of entries) {
    if (!entry.page.lazy) continue
    lines.push(
      `const ${entry.bindingId} = lazy(() => import('${entry.sourcePath}'))`,
    )
  }
  // Redirects re-export
  if (scan.redirectsFile) {
    lines.push(
      `import __userRedirects from '${toViewImportPath(viewsRoot, scan.redirectsFile)}'`,
    )
  } else {
    lines.push(`const __userRedirects = []`)
  }

  // Flat absolute-path record per page — used by appRoutes & sidebarTree.
  for (const entry of entries) {
    lines.push(
      `const ${entry.bindingId}_r = ${renderRouteRecord(entry.bindingId, entry.page)}`,
    )
  }

  // Nested shell route records — leaves first so parents can reference children by name.
  // Child paths are relative to parent (React Router nested-route requirement).
  const shellEntries = entries.filter((e) => e.page.layout === 'shell')
  const publicEntries = entries.filter((e) => e.page.layout === 'public')
  const shellTree = buildShellRouteTree(shellEntries)
  function emitShellNode(node: ShellTreeNode, parentUrl: string | null) {
    for (const child of node.children) {
      emitShellNode(child, node.entry.page.url)
    }
    const path =
      parentUrl === null
        ? node.entry.page.url
        : relativeChildPath(parentUrl, node.entry.page.url)
    const childBindings = node.children.map((c) => `${c.entry.bindingId}_n`)
    lines.push(
      `const ${node.entry.bindingId}_n = ${renderRouteRecord(node.entry.bindingId, node.entry.page, path, childBindings)}`,
    )
  }
  for (const root of shellTree) {
    emitShellNode(root, null)
  }

  lines.push(
    `export const appRoutes = [${entries.map((e) => `${e.bindingId}_r`).join(', ')}]`,
  )
  lines.push(
    `export const publicRoutes = [${publicEntries.map((e) => `${e.bindingId}_r`).join(', ')}]`,
  )
  // shellRoutes only exposes top-level (root) shell routes; nested children are embedded as `children`.
  lines.push(
    `export const shellRoutes = [${shellTree.map((n) => `${n.entry.bindingId}_n`).join(', ')}]`,
  )

  // Sidebar tree per section
  const sectionTreeParts: string[] = []
  const sectionsSorted = [...sectionsWithPages.entries()].sort((a, b) => {
    const sa = sectionByName.get(a[0])
    const sb = sectionByName.get(b[0])
    const oa = sa?.meta?.order ?? 0
    const ob = sb?.meta?.order ?? 0
    if (oa !== ob) return oa - ob
    return a[0].localeCompare(b[0])
  })
  for (const [sectionName, sectionEntries] of sectionsSorted) {
    const section = sectionByName.get(sectionName)
    const titleKey = section?.meta?.titleKey
    const order = section?.meta?.order ?? 0
    const tree = buildSectionTree(sectionEntries)
    const topLevelPages = sortByOrder(
      tree
        .map((node) => node.entry.page)
        .filter(
          (p) =>
            !p.metadata.hidden && !p.url.includes(':') && !p.url.includes('*'),
        ),
    )
    const topMap = new Map(tree.map((n) => [n.entry.page.url, n]))
    const items = topLevelPages
      .map((p) => topMap.get(p.url))
      .filter((n): n is TreeNode => Boolean(n))
    if (!items.length) continue
    const titlePart = titleKey ? `titleKey: ${escapeString(titleKey)}, ` : ''
    sectionTreeParts.push(
      `{ ${titlePart}order: ${order}, items: [${items.map(renderSidebarNode).join(', ')}] }`,
    )
  }
  lines.push(`export const sidebarTree = [${sectionTreeParts.join(', ')}]`)
  lines.push(`export const redirects = __userRedirects`)

  return lines.join('\n')
}
