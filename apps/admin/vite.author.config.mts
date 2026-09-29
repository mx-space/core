import { existsSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

import { esToolkitCompatShim } from './vite-plugins/es-toolkit-compat-shim'

const __dirname = dirname(fileURLToPath(import.meta.url))

const renameAuthorHtml = (): Plugin => ({
  name: 'rename-author-html',
  closeBundle() {
    const from = resolve(__dirname, 'dist-author/author.html')
    const to = resolve(__dirname, 'dist-author/index.html')
    if (existsSync(from)) renameSync(from, to)
  },
})

export default defineConfig({
  plugins: [
    esToolkitCompatShim(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    renameAuthorHtml(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'loro-crdt': 'loro-crdt/base64',
      path: 'path-browserify',
      os: 'os-browserify',
      'node-fetch': 'isomorphic-fetch',
      buffer: 'buffer',
    },
  },
  define: {
    __DEV__: false,
  },
  base: './',
  root: __dirname,
  build: {
    outDir: resolve(__dirname, 'dist-author'),
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'author.html'),
      },
    },
  },
})
