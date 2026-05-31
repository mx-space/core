import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { PluginOption } from 'vite'
import { loadEnv } from 'vite'
import { checker } from 'vite-plugin-checker'
import { defineConfig } from 'vitest/config'

import PKG from './package.json'
import { adminRoutes } from './vite-plugins/admin-routes'
import { esToolkitCompatShim } from './vite-plugins/es-toolkit-compat-shim'

const __dirname = dirname(fileURLToPath(import.meta.url))

// dns.setDefaultResultOrder('verbatim')
export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const { VITE_APP_PUBLIC_URL } = env
  const isDev = mode === 'development'

  return defineConfig({
    plugins: [
      // mkcert(),
      esToolkitCompatShim(),
      codeInspectorPlugin({ bundler: 'vite' }),
      adminRoutes({ viewsDir: resolve(__dirname, 'src/views') }),
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),

      checker({
        enableBuild: true,
      }),
      htmlPlugin(env),
      // nodePolyfills({
      //   // To exclude specific polyfills, add them to this list.
      //   exclude: [
      //     'fs', // Excludes the polyfill for `fs` and `node:fs`.
      //   ],
      //   // Whether to polyfill `node:` protocol imports.
      //   protocolImports: true,
      // }),
    ],

    resolve: {
      tsconfigPaths: true,
      alias: {
        path: 'path-browserify',
        os: 'os-browserify',
        'node-fetch': 'isomorphic-fetch',
        buffer: 'buffer',
      },
    },

    build: {
      chunkSizeWarningLimit: 2500,
      target: 'esnext',

      // sourcemap: true,
      rollupOptions: {
        output: {
          chunkFileNames: `js/[name]-[hash].js`,
          entryFileNames: `js/[name]-[hash].js`,
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return

            const normalized = id.replaceAll('\\', '/')

            if (normalized.includes('/react-dom/')) return 'vendor-react-dom'
            if (
              normalized.includes('/react/') ||
              normalized.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }

            if (normalized.includes('/@tanstack/')) return 'vendor-tanstack'
            if (normalized.includes('/@base-ui-components/')) {
              return 'vendor-base-ui'
            }
            if (normalized.includes('/lucide-react/')) return 'vendor-icons'

            if (
              normalized.includes('/@lexical/') ||
              normalized.includes('/lexical/')
            ) {
              return 'editor-lexical'
            }
            if (normalized.includes('/katex/')) return 'editor-katex'
            if (normalized.includes('/cytoscape/')) return 'editor-graph'
            if (normalized.includes('/elkjs/')) return 'editor-elk'
            if (normalized.includes('/roughjs/')) return 'editor-rough'

            const haklexChunk = getScopedPackageChunk(
              normalized,
              '@haklex/',
              'haklex',
            )
            if (haklexChunk) return haklexChunk

            if (normalized.includes('/monaco-editor/')) return 'editor-monaco'
            if (normalized.includes('/@antv/')) return 'vendor-charts'
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['@huacnlee/autocorrect', '@dqbd/tiktoken'],
    },

    define: {
      __DEV__: isDev,
    },
    base: !isDev ? VITE_APP_PUBLIC_URL || '' : '',

    server: {
      // https: true,
      port: 9528,
    },
    oxc: {
      jsx: {
        runtime: 'automatic',
        importSource: 'react',
      },
    },
    test: {
      environment: 'happy-dom',
      setupFiles: [resolve(__dirname, 'test/setup.ts')],
    },
  })
}

const htmlPlugin: (env: any) => PluginOption = (env) => {
  return {
    name: 'html-transform',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(
          '<!-- MX SPACE ADMIN DASHBOARD VERSION INJECT -->',
          `<script>window.version = '${PKG.version}';</script>`,
        )
        .replaceAll('@gh-pages', `@page_v${PKG.version}`)
        .replace(
          '<!-- ENV INJECT -->',
          `<script id="env_injection">window.injectData = {WEB_URL:'${
            env.VITE_APP_WEB_URL || ''
          }', GATEWAY: '${env.VITE_APP_GATEWAY || ''}',BASE_API: '${
            env.VITE_APP_BASE_API || ''
          }'}</script>`,
        )
    },
  }
}

function getScopedPackageChunk(id: string, scope: string, prefix: string) {
  const marker = `/node_modules/${scope}`
  const markerIndex = id.lastIndexOf(marker)
  if (markerIndex === -1) return

  const packagePath = id.slice(markerIndex + marker.length)
  const packageName = packagePath.split('/')[0]
  if (!packageName) return

  return `${prefix}-${packageName.replaceAll(/[^\w-]/g, '-')}`
}
