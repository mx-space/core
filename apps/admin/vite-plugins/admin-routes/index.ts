import { basename, normalize, sep } from 'node:path'

import type { Plugin, ViteDevServer } from 'vite'

import { generateModule } from './generate'
import { scanViews } from './scan'

const VIRTUAL_ID = 'virtual:admin-routes'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

const RECOGNISED_FILES = new Set(['page.tsx', 'page.sync.tsx', 'meta.ts'])

export interface AdminRoutesOptions {
  viewsDir: string
  /**
   * 于 production build 之 index.html 中为 lazy router import 之 chunk 注 `<link
   * rel="modulepreload">`，使浏览器后台预下，免点页时 lazy 等。
   * - `true`（默认）：所 lazy page chunk 皆注
   * - `false`：禁
   * - `'top-level-only'`：仅顶级 page（不含 `[param]` 之子 route）
   */
  preloadLazyRoutes?: boolean | 'top-level-only'
}

export function adminRoutes(options: AdminRoutesOptions): Plugin {
  const viewsDir = normalize(options.viewsDir)
  const preloadLazyRoutes = options.preloadLazyRoutes ?? true
  let isDev = false
  let basePrefix = '/'

  return {
    name: 'admin-routes',
    enforce: 'pre',
    configResolved(config) {
      isDev = config.command === 'serve'
      basePrefix = config.base || '/'
      if (!basePrefix.endsWith('/')) basePrefix += '/'
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(viewsDir)
      const onChange = (file: string) => {
        const normalized = normalize(file)
        if (!normalized.startsWith(viewsDir + sep) && normalized !== viewsDir) {
          return
        }
        const base = basename(normalized)
        const isRedirects =
          base === 'redirects.ts' && normalized === viewsDir + sep + base
        if (!RECOGNISED_FILES.has(base) && !isRedirects) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('change', onChange)
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      const scan = scanViews(viewsDir)
      return generateModule(scan, { viewsRoot: viewsDir, isDev })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // dev 不注（vite 直供源码，modulepreload 无 chunk 可指）；opt-out 时亦不注。
        if (isDev || !preloadLazyRoutes) {
          return html
        }
        if (!ctx.bundle) return html
        const scan = scanViews(viewsDir)
        const lazyAbsPaths = new Set<string>(
          scan.pages
            .filter((p) => p.lazy)
            .filter((p) =>
              preloadLazyRoutes === 'top-level-only'
                ? !p.url.includes(':') && !p.url.includes('*')
                : true,
            )
            .map((p) => normalize(p.filePath).split(sep).join('/')),
        )
        const fileNames: string[] = []
        for (const fileName of Object.keys(ctx.bundle)) {
          const chunk = ctx.bundle[fileName]
          if (chunk.type !== 'chunk') continue
          // 优先 facadeModuleId（dynamic-import 之 chunk entry），次扫 moduleIds。
          const candidates: string[] = []
          if (chunk.facadeModuleId) candidates.push(chunk.facadeModuleId)
          const modIds = (chunk as { moduleIds?: string[] }).moduleIds
          if (Array.isArray(modIds)) candidates.push(...modIds)
          for (const c of candidates) {
            const norm = normalize(c).split(sep).join('/')
            if (lazyAbsPaths.has(norm)) {
              fileNames.push(chunk.fileName)
              break
            }
          }
        }
        if (fileNames.length === 0) return html
        // 径以字符串插入 head；vite 之 tags 数组在某些 enforce 后插件之后可能丢，
        // 故直 inline 入 HTML 更可靠。
        const linkTags = fileNames
          .map(
            (f) =>
              `<link rel="modulepreload" crossorigin href="${basePrefix}${f}">`,
          )
          .join('\n    ')
        return html.replace(/<\/head>/i, `    ${linkTags}\n  </head>`)
      },
    },
  }
}

export default adminRoutes
