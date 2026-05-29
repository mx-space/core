import { basename, normalize, sep } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

import { generateModule } from './generate'
import { scanViews } from './scan'

const VIRTUAL_ID = 'virtual:admin-routes'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

const RECOGNISED_FILES = new Set(['page.tsx', 'page.sync.tsx', 'meta.ts'])

export interface AdminRoutesOptions {
  viewsDir: string
}

export function adminRoutes(options: AdminRoutesOptions): Plugin {
  const viewsDir = normalize(options.viewsDir)
  let isDev = false

  return {
    name: 'admin-routes',
    enforce: 'pre',
    configResolved(config) {
      isDev = config.command === 'serve'
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
  }
}

export default adminRoutes
