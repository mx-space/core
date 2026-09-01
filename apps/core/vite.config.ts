import { resolve } from 'node:path'

import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import zodCompiler from 'zod-compiler/vite'

import { zodCompilerOptions } from './zod-compiler.config'

// Node decodes a module's source into a one-byte string only when it is pure
// ASCII; a single char above 0x7f flips the whole source to UTF-16, and V8
// keeps that source alive forever for lazy inner-function compilation. Escaping
// halves the retained source of the main chunk (~26MB -> ~13MB).
const NON_ASCII = /\P{ASCII}/gu

const escapeNonAsciiPlugin = () => ({
  name: 'escape-non-ascii',
  generateBundle(_options: unknown, bundle: Record<string, any>) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'chunk') continue
      file.code = file.code.replaceAll(NON_ASCII, (match: string) =>
        Array.from(
          { length: match.length },
          (_, index) =>
            `\\u${match.charCodeAt(index).toString(16).padStart(4, '0')}`,
        ).join(''),
      )
    }
  },
})

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    esbuild: false,
    define: {
      __DEV__: isBuild ? 'false' : 'true',
      __TEST__: 'false',
    },
    plugins: [
      zodCompiler(zodCompilerOptions),
      swc.vite(),
      tsconfigPaths({
        projects: [resolve(__dirname, './tsconfig.json')],
      }),
      ...(isBuild ? [escapeNonAsciiPlugin()] : []),
    ],
    ...(isBuild && {
      ssr: {
        noExternal: true,
        target: 'node',
      },
      build: {
        outDir: 'out',
        emptyOutDir: true,
        target: 'node22',
        sourcemap: false,
        minify: false,
        ssr: true,
        rolldownOptions: {
          input: {
            main: resolve(__dirname, 'src/main.ts'),
            migrate: resolve(__dirname, 'src/migrate.ts'),
            'app-migrate': resolve(__dirname, 'src/app-migrate.ts'),
          },
          output: {
            format: 'esm',
            minify: {
              compress: true,
              mangle: true,
              codegen: { removeWhitespace: true },
            },
            entryFileNames: '[name].mjs',
            chunkFileNames: 'chunks/[name]-[hash].mjs',
          },
          external: ['sharp', 'ws'],
        },
      },
    }),
  }
})
